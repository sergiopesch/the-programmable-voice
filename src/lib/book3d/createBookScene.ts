import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Matrix4,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type WebGLRenderTarget,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import type { Theme } from '../../hooks/usePreferences'
import { bookEnvironmentCandidates } from './bookAssets'
import { bookFaceFromAzimuth, cameraAzimuthDegrees, shortestAngleDelta, type BookFace } from './bookView'
import { resolveBookOutputPixelRatio, selectBookRenderQuality } from './bookQuality'
import { createBookModel } from './createBookModel'
import { createBookTextures } from './createBookTextures'
import {
  createFallbackBookSurfaceTextures,
  loadBookSurfaceTextures,
  type BookSurfaceTextures,
} from './loadBookPbrTextures'
import {
  BOOK_CAMERA,
  BOOK_GEOMETRY,
  BOOK_PAGE_WIDTH,
} from './bookGeometry'

export interface BookSceneController {
  open: () => Promise<void>
  finishOpening: () => void
  reset: () => void
  rotateBy: (degrees: number, verticalDegrees?: number) => void
  zoomBy: (factor: number) => void
  setTheme: (theme: Theme) => void
  dispose: () => void
}

interface BookSceneOptions {
  host: HTMLDivElement
  deck: string
  openingParagraphs: string[]
  openingPart: string
  openingTitle: string
  theme: Theme
  onReady: () => void
  onHandoffReady: () => void
  shouldSkipClosedFirstFrame: () => boolean
  onViewChange: (face: BookFace) => void
  onContextLost: () => void
}

interface OpeningAnimation {
  duration: number
  /** Visual-audit-only deterministic pose supplied by `bookOpeningSeek`. */
  seekProgress?: number
  startedAt: number
  fromSpherical: Spherical
  toSpherical: Spherical
  thetaDelta: number
  fromTarget: Vector3
  toTarget: Vector3
  fromUp: Vector3
  toUp: Vector3
  resolve: () => void
}

const BOOK_HEIGHT = BOOK_GEOMETRY.boardHeight

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(value: number) {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}

function dampedLanding(value: number) {
  const clamped = clamp01(value)
  const primary = easeInOutCubic(clamped)
  const rebound = clamped > 0.76
    ? Math.sin((clamped - 0.76) / 0.24 * Math.PI * 2.2) * (1 - clamped) * 0.045
    : 0
  return clamp01(primary + rebound)
}

function updateOpeningLeafGeometry(
  geometry: import('three').PlaneGeometry,
  sourcePositions: Float32Array,
  progress: number,
  index: number,
) {
  const position = geometry.getAttribute('position') as import('three').BufferAttribute
  const pageWidth = BOOK_PAGE_WIDTH
  const widthSegments = geometry.parameters.widthSegments
  const profileX = new Float32Array(widthSegments + 1)
  const profileZ = new Float32Array(widthSegments + 1)
  const rotation = Math.PI * smoothstep(progress)
  const curl = MathUtils.degToRad(31 + index * 4.5) * Math.sin(Math.PI * progress)
  const segmentLength = pageWidth / widthSegments

  // Integrate a tangent-angle field along the sheet. Because every step keeps
  // its original arc length and y remains unchanged, this is a cylindrical
  // developable surface: the paper bends but never stretches. A broad primary
  // bow plus a quiet travelling inflection avoids both a rigid board-like leaf
  // and the clipped triangular silhouette produced by the former cone/floor.
  for (let column = 1; column <= widthSegments; column += 1) {
    const along = (column - 0.5) / widthSegments
    const localAngle = rotation
      - curl * Math.sin(Math.PI * along)
      + curl * 0.22 * Math.sin(Math.PI * 2 * along + index * 0.52)
    profileX[column] = profileX[column - 1]! + Math.cos(localAngle) * segmentLength
    profileZ[column] = profileZ[column - 1]! + Math.sin(localAngle) * segmentLength
  }

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const offset = vertex * 3
    const sourceX = sourcePositions[offset] ?? 0
    const sourceY = sourcePositions[offset + 1] ?? 0
    const u = MathUtils.clamp(sourceX + pageWidth / 2, 0, pageWidth)
    const column = Math.min(widthSegments, Math.max(0, Math.round(u / pageWidth * widthSegments)))
    position.setXYZ(
      vertex,
      profileX[column]! - pageWidth / 2,
      sourceY,
      profileZ[column]!,
    )
  }
  position.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeVertexNormals()
}

function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()

  root.traverse((object) => {
    const candidate = object as Object3D & {
      geometry?: BufferGeometry
      material?: Material | Material[]
    }
    if (candidate.geometry) geometries.add(candidate.geometry)
    const objectMaterials = Array.isArray(candidate.material) ? candidate.material : [candidate.material]
    objectMaterials.forEach((material) => {
      if (!material) return
      materials.add(material)
      Object.values(material).forEach((value) => {
        if (value && typeof value === 'object' && 'isTexture' in value) {
          textures.add(value as Texture)
        }
      })
    })
  })

  textures.forEach((texture) => texture.dispose())
  materials.forEach((material) => material.dispose())
  geometries.forEach((geometry) => geometry.dispose())
}

export async function createBookScene({
  host,
  deck,
  openingParagraphs,
  openingPart,
  openingTitle,
  theme,
  onReady,
  onHandoffReady,
  shouldSkipClosedFirstFrame,
  onViewChange,
  onContextLost,
}: BookSceneOptions): Promise<BookSceneController> {
  if (!window.WebGL2RenderingContext) throw new Error('WebGL 2 is unavailable')

  const fontPreparation = Promise.allSettled([
    document.fonts.load('500 72px "Newsreader Variable"'),
    document.fonts.load('400 24px "IBM Plex Mono"'),
  ])
  await Promise.race([
    fontPreparation,
    new Promise<void>((resolve) => window.setTimeout(resolve, 800)),
  ])

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    premultipliedAlpha: true,
  })
  try {
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = theme === 'dark' ? 1.32 : 1.28
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.domElement.className = 'book3d-stage__canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  renderer.domElement.tabIndex = -1

  const quality = selectBookRenderQuality(renderer, host)
  renderer.setPixelRatio(quality.pixelRatio)
  const stageElement = host.closest<HTMLElement>('.book3d-stage')
  stageElement?.setAttribute('data-output-tier', quality.outputTier)
  stageElement?.setAttribute('data-render-target-long-edge', `${quality.renderLongEdge}`)
  stageElement?.setAttribute('data-texture-tier-requested', quality.textureTier)
  stageElement?.setAttribute('data-texture-tier', quality.textureTier)
  stageElement?.setAttribute('data-textures-ready', 'false')
  renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false)
  stageElement?.setAttribute('data-render-width', `${renderer.domElement.width}`)
  stageElement?.setAttribute('data-render-height', `${renderer.domElement.height}`)
  host.append(renderer.domElement)

  const loadSurfaceTier = async (): Promise<{
    textures: BookSurfaceTextures
    tier: '2k' | '4k' | 'fallback'
    loaded: boolean
  }> => {
    const anisotropy = renderer.capabilities.getMaxAnisotropy()
    try {
      return {
        textures: await loadBookSurfaceTextures({ anisotropy, tier: quality.textureTier }),
        tier: quality.textureTier,
        loaded: true,
      }
    } catch {
      if (quality.textureTier === '4k') {
        try {
          return {
            textures: await loadBookSurfaceTextures({ anisotropy, tier: '2k' }),
            tier: '2k',
            loaded: true,
          }
        } catch {
          // The procedural material below still preserves a coherent book.
        }
      }
      return { textures: createFallbackBookSurfaceTextures(), tier: 'fallback', loaded: false }
    }
  }
  const initialSurfaceTexturesPromise = loadSurfaceTier()

  const scene = new Scene()
  const camera = new PerspectiveCamera(BOOK_CAMERA.fov, 1, 0.1, 80)
  const target = new Vector3(0, -0.12, 0)
  const defaultDirection = new Vector3(
    BOOK_CAMERA.closedDirection.x,
    BOOK_CAMERA.closedDirection.y,
    BOOK_CAMERA.closedDirection.z,
  ).normalize()
  let fittedDistance = 12
  let hasFittedCamera = false
  camera.position.copy(defaultDirection).multiplyScalar(fittedDistance).add(target)
  camera.lookAt(target)

  const pmrem = new PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  let roomEnvironment: RoomEnvironment | null = null
  let environmentTarget: WebGLRenderTarget
  let environmentResult: { target: WebGLRenderTarget; tier: '2k' | '4k' } | null = null
  for (const candidate of bookEnvironmentCandidates(quality.textureTier)) {
    try {
      const hdri = await new HDRLoader().loadAsync(candidate.path)
      const target = pmrem.fromEquirectangular(hdri)
      hdri.dispose()
      environmentResult = { target, tier: candidate.tier }
      break
    } catch {
      // Source deployments omit 4K files; retry the complete 2K environment.
    }
  }
  if (environmentResult) {
    environmentTarget = environmentResult.target
    stageElement?.setAttribute('data-environment-tier', environmentResult.tier)
  } else {
    roomEnvironment = new RoomEnvironment()
    environmentTarget = pmrem.fromScene(roomEnvironment, 0.04)
    stageElement?.setAttribute('data-environment-tier', 'procedural')
  }
  scene.environment = environmentTarget.texture
  scene.environmentIntensity = theme === 'dark' ? 0.8 : 0.88

  const hemisphere = new HemisphereLight(
    theme === 'dark' ? new Color('#e6e8e6') : new Color('#fffaf0'),
    theme === 'dark' ? new Color('#16191b') : new Color('#2b2b2a'),
    theme === 'dark' ? 0.55 : 0.65,
  )
  scene.add(hemisphere)

  // Broad studio bounce keeps the charcoal cloth readable without flattening
  // the key-light shadows that describe the boards, spine, and page block.
  const studioBounce = new AmbientLight('#e7dfd2', theme === 'dark' ? 0.76 : 0.9)
  scene.add(studioBounce)

  const key = new DirectionalLight('#fff8ee', theme === 'dark' ? 3.4 : 3.7)
  key.position.set(4.5, 8, 5.5)
  key.castShadow = true
  key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 28
  key.shadow.camera.left = -6.5
  key.shadow.camera.right = 6.5
  key.shadow.camera.top = 7.5
  key.shadow.camera.bottom = -7.5
  key.shadow.bias = -0.00025
  key.shadow.normalBias = 0.018
  key.shadow.radius = 5
  scene.add(key)

  const rim = new DirectionalLight('#a8bfd0', theme === 'dark' ? 0.82 : 0.74)
  rim.position.set(-5, 3, -5)
  scene.add(rim)

  const applyTheme = (nextTheme: Theme) => {
    const dark = nextTheme === 'dark'
    renderer.toneMappingExposure = dark ? 1.32 : 1.28
    scene.environmentIntensity = dark ? 0.8 : 0.88
    hemisphere.color.set(dark ? '#e6e8e6' : '#fffaf0')
    hemisphere.groundColor.set(dark ? '#16191b' : '#2b2b2a')
    hemisphere.intensity = dark ? 0.55 : 0.65
    studioBounce.intensity = dark ? 0.76 : 0.9
    key.intensity = dark ? 3.4 : 3.7
    rim.intensity = dark ? 0.82 : 0.74
  }

  const textures = createBookTextures({
    deck,
    openingParagraphs,
    openingPart,
    openingTitle,
    tier: quality.textureTier,
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
  })
  const coverArtworkSource = textures.coverFront.source.data as { height?: number; width?: number }
  stageElement?.setAttribute('data-artwork-width', `${coverArtworkSource.width ?? 0}`)
  stageElement?.setAttribute('data-artwork-height', `${coverArtworkSource.height ?? 0}`)
  const surfaceResult = await initialSurfaceTexturesPromise
  const surfaceTextures = surfaceResult.textures
  stageElement?.setAttribute('data-texture-tier', surfaceResult.tier)
  const model = createBookModel(textures, surfaceTextures)
  scene.add(model.root)

  // The reference gesture begins with a hardback standing on its tail and
  // finishes with the spread supported by the table. Keeping the volume at a
  // permanently near-horizontal tilt made the cover rise toward the lens as a
  // white triangular slab. Articulate the whole sewn volume through that
  // change of posture and preserve one physical contact line throughout.
  const CLOSED_VOLUME_TILT = -0.22
  const OPEN_VOLUME_TILT = -1.38
  const supportSurfaceY = -BOOK_HEIGHT / 2 - 0.16
  const shadowReceiver = model.root.getObjectByName('contact-shadow-receiver')
  if (shadowReceiver) shadowReceiver.position.y = supportSurfaceY
  const setVolumePosture = (progress: number) => {
    model.volume.rotation.x = MathUtils.lerp(
      CLOSED_VOLUME_TILT,
      OPEN_VOLUME_TILT,
      smoothstep(progress),
    )
    model.volume.position.y = 0
    model.volume.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model.volume, true)
    model.volume.position.y = supportSurfaceY + 0.045 - bounds.min.y
    model.root.updateMatrixWorld(true)
  }
  setVolumePosture(0)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(target)
  controls.enableDamping = true
  controls.dampingFactor = 0.075
  controls.enablePan = false
  controls.enableZoom = false
  controls.enableRotate = true
  controls.rotateSpeed = 0.78
  controls.autoRotate = false
  controls.minPolarAngle = 0.34
  controls.maxPolarAngle = Math.PI - 0.34
  controls.minAzimuthAngle = -Infinity
  controls.maxAzimuthAngle = Infinity
  renderer.domElement.style.touchAction = 'pan-y'

  let disposed = false
  let frame = 0
  let openingAnimation: OpeningAnimation | null = null
  let openingPromise: Promise<void> | null = null
  let openingDeadlineTimer = 0
  let lastFace: BookFace | null = null
  let handoffReady = false
  const animatedTarget = new Vector3()
  const animatedOffset = new Vector3()
  const animatedSpherical = new Spherical()
  const animatedUp = new Vector3()

  const fitDistanceForObject = (
    root: Object3D,
    viewDirection: Vector3,
    up: Vector3,
    padding: number = BOOK_CAMERA.fitPadding,
  ) => {
    const backward = viewDirection.clone().normalize()
    const right = new Vector3().crossVectors(up, backward).normalize()
    const cameraUp = new Vector3().crossVectors(backward, right).normalize()
    const points: Vector3[] = []
    const instanceMatrix = new Matrix4()
    const worldMatrix = new Matrix4()
    root.updateMatrixWorld(true)
    root.traverseVisible((object) => {
      const candidate = object as Object3D & {
        count?: number
        geometry?: BufferGeometry
        getMatrixAt?: (index: number, matrix: Matrix4) => void
        isInstancedMesh?: boolean
      }
      const geometry = candidate.geometry
      if (!geometry) return
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      const box = geometry.boundingBox
      if (!box) return
      const appendCorners = (matrix: Matrix4) => {
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              points.push(new Vector3(x, y, z).applyMatrix4(matrix))
            }
          }
        }
      }
      if (candidate.isInstancedMesh && candidate.getMatrixAt && candidate.count) {
        for (let index = 0; index < candidate.count; index += 1) {
          candidate.getMatrixAt(index, instanceMatrix)
          worldMatrix.multiplyMatrices(candidate.matrixWorld, instanceMatrix)
          appendCorners(worldMatrix)
        }
      } else {
        appendCorners(candidate.matrixWorld)
      }
    })
    if (!points.length) {
      const bounds = new Box3().setFromObject(root, true)
      points.push(bounds.min.clone(), bounds.max.clone())
    }

    let minRight = Infinity
    let maxRight = -Infinity
    let minUp = Infinity
    let maxUp = -Infinity
    let minDepth = Infinity
    let maxDepth = -Infinity
    points.forEach((point) => {
      const projectedRight = point.dot(right)
      const projectedUp = point.dot(cameraUp)
      const projectedDepth = point.dot(backward)
      minRight = Math.min(minRight, projectedRight)
      maxRight = Math.max(maxRight, projectedRight)
      minUp = Math.min(minUp, projectedUp)
      maxUp = Math.max(maxUp, projectedUp)
      minDepth = Math.min(minDepth, projectedDepth)
      maxDepth = Math.max(maxDepth, projectedDepth)
    })
    const centre = right.clone().multiplyScalar((minRight + maxRight) / 2)
      .addScaledVector(cameraUp, (minUp + maxUp) / 2)
      .addScaledVector(backward, (minDepth + maxDepth) / 2)
    const verticalTangent = Math.tan(MathUtils.degToRad(camera.fov) / 2)
    const horizontalTangent = verticalTangent * camera.aspect
    let distance = 0

    points.forEach((point) => {
      const relative = point.clone().sub(centre)
      const towardsCamera = relative.dot(backward)
      distance = Math.max(
        distance,
        towardsCamera + Math.abs(relative.dot(right)) / horizontalTangent,
        towardsCamera + Math.abs(relative.dot(cameraUp)) / verticalTangent,
      )
    })

    return { centre, distance: distance * padding }
  }

  const openedCameraPose = () => {
    const previousCoverRotation = model.frontCoverPivot.rotation.y
    const previousGatheringVisibility = model.openingPageBlockPivot.visible
    const previousLeafVisibility = model.openingLeaves.map(({ pivot }) => pivot.visible)
    const previousVolumeRotation = model.volume.rotation.x
    const previousVolumePosition = model.volume.position.y
    setVolumePosture(1)
    model.frontCoverPivot.rotation.y = -Math.PI * 0.99
    model.openingPageBlockPivot.visible = false
    model.openingLeaves.forEach(({ pivot }) => { pivot.visible = false })
    model.root.updateMatrixWorld(true)
    const volumeQuaternion = model.volume.getWorldQuaternion(new Quaternion())
    // Derive the final plan view from the physical volume itself. This keeps
    // the camera on the paper side of the model and makes the last WebGL frame
    // congruent with the front-on semantic spread instead of hard-cutting from
    // the initial oblique inspection angle.
    const viewDirection = new Vector3(0, 0, 1).applyQuaternion(volumeQuaternion).normalize()
    const up = new Vector3(0, 1, 0).applyQuaternion(volumeQuaternion).normalize()
    const pose = fitDistanceForObject(model.volume, viewDirection, up, 1.025)
    model.frontCoverPivot.rotation.y = previousCoverRotation
    model.volume.rotation.x = previousVolumeRotation
    model.volume.position.y = previousVolumePosition
    model.openingPageBlockPivot.visible = previousGatheringVisibility
    model.openingLeaves.forEach(({ pivot }, index) => {
      pivot.visible = previousLeafVisibility[index] ?? true
    })
    model.root.updateMatrixWorld(true)
    return { ...pose, up, viewDirection }
  }

  const finishOpening = () => {
    if (!openingAnimation || disposed) return
    window.clearTimeout(openingDeadlineTimer)
    openingDeadlineTimer = 0
    const animation = openingAnimation
    controls.target.copy(animation.toTarget)
    animatedOffset.setFromSpherical(animation.toSpherical)
    camera.position.copy(animatedOffset).add(animation.toTarget)
    camera.up.copy(animation.toUp)
    camera.lookAt(animation.toTarget)
    setVolumePosture(1)
    model.frontCoverPivot.rotation.y = -Math.PI * 0.99
    // The text block is sewn to the rear casing. It compresses at the joint
    // but never follows the front board across the gutter as a rigid slab.
    model.openingPageBlockPivot.rotation.y = 0
    model.openingPageBlockPivot.visible = false
    model.openingLeaves.forEach(({ pivot, geometry, sourcePositions }, index) => {
      pivot.rotation.y = 0
      updateOpeningLeafGeometry(geometry, sourcePositions, 1, index)
      pivot.visible = false
    })
    renderer.domElement.style.opacity = '1'
    stageElement?.setAttribute('data-opening-progress', '1.000')
    stageElement?.setAttribute('data-opening-phase', 'settled')
    if (!handoffReady) {
      handoffReady = true
      onHandoffReady()
    }
    openingAnimation = null
    renderer.render(scene, camera)
    animation.resolve()
  }

  const reportFace = () => {
    const offset = camera.position.clone().sub(controls.target)
    const face = bookFaceFromAzimuth(cameraAzimuthDegrees(offset.x, offset.z))
    updateCoverArtworkVisibility(offset)
    host.closest<HTMLElement>('.book3d-stage')?.setAttribute('data-book-view', face)
    if (face !== lastFace) {
      lastFace = face
      onViewChange(face)
    }
  }

  const updateCoverArtworkVisibility = (offset: Vector3) => {
    model.frontArtwork.visible = offset.z >= 0
    model.backArtwork.visible = offset.z < 0
    const stage = host.closest<HTMLElement>('.book3d-stage')
    stage?.setAttribute('data-visible-cover-artwork', offset.z >= 0 ? 'front' : 'back')
  }

  const renderFrame = (now: number) => {
    frame = 0
    if (disposed || document.hidden) return

    if (openingAnimation) {
      // Opening duration is wall-clock deterministic. Capping each frame's
      // contribution made a nominal two-second gesture remain in its peel
      // phase for five seconds on a 4K drawing buffer.
      const progress = openingAnimation.seekProgress ?? Math.min(1, Math.max(
        0,
        (now - openingAnimation.startedAt) / openingAnimation.duration,
      ))
      stageElement?.setAttribute('data-opening-progress', progress.toFixed(3))
      stageElement?.setAttribute('data-opening-phase', progress < 0.2
        ? 'peel'
        : progress < 0.5
          ? 'rise'
          : progress < 0.82
            ? 'cross'
            : 'settle')
      // Once the physical leaves have flattened, replace only their printed
      // faces with the native semantic spread. The Three casing remains below
      // it, so the final 8% is a matched-material handoff instead of an
      // unavoidable canvas-font-to-DOM hard cut.
      if (progress >= 0.92 && !handoffReady) {
        handoffReady = true
        onHandoffReady()
      }
      // The fore edge cracks free immediately, then the board's inertia takes
      // over. A small early angle makes the causality legible without making
      // the heavy cover spring up unrealistically.
      const foreEdgeRelease = smoothstep(progress / 0.18) * 0.045
      const coverProgress = clamp01(
        foreEdgeRelease + (1 - foreEdgeRelease) * dampedLanding((progress - 0.14) / 0.7),
      )
      // Reframe late: the cover swing should remain spatially legible before
      // the view settles into the front-on reading projection. Rotating toward
      // plan view too early made the flyleaves read as full-height white slabs.
      // Begin the move toward the final plan view as the flyleaves release.
      // Holding the inspection camera until late made the cascade read as a
      // tiny oblique fan; the storyboard calls for broad leaves presented
      // frontally while the cover remains spatially legible.
      const cameraProgress = smoothstep((progress - 0.3) / 0.55)
      animatedTarget.lerpVectors(openingAnimation.fromTarget, openingAnimation.toTarget, cameraProgress)
      animatedSpherical.set(
        MathUtils.lerp(openingAnimation.fromSpherical.radius, openingAnimation.toSpherical.radius, cameraProgress),
        MathUtils.lerp(openingAnimation.fromSpherical.phi, openingAnimation.toSpherical.phi, cameraProgress),
        openingAnimation.fromSpherical.theta + openingAnimation.thetaDelta * cameraProgress,
      )
      animatedOffset.setFromSpherical(animatedSpherical)
      animatedUp.lerpVectors(openingAnimation.fromUp, openingAnimation.toUp, cameraProgress).normalize()

      // A hardback does not open as one rigid slab. The board first cracks at
      // the joint, then accelerates as its centre of mass passes the hinge and
      // finishes with a small, critically damped landing.
      model.frontCoverPivot.rotation.y = -Math.PI * 0.99 * coverProgress
      // The casing lowers from its upright inspection posture only after the
      // joint has released. By the time the leaves cross the gutter it is
      // already approaching the final plan-view reading surface.
      const volumeProgress = smoothstep((progress - 0.16) / 0.44)
      setVolumePosture(volumeProgress)
      // A few degrees of joint compression give the fore edge room to release
      // while the weight of the page block remains supported on the rear board.
      const compression = Math.sin(Math.PI * clamp01((progress - 0.24) / 0.52))
      model.openingPageBlockPivot.rotation.y = -MathUtils.degToRad(4.5) * compression

      // Flyleaves release from the fore-edge in a short cascade while their
      // gutter edge remains bound. Each leaf bends independently so the stack
      // never becomes the intersecting white fan produced by rigid planes.
      const leafReleases = [0.3, 0.35, 0.4]
      const leafDurations = [0.58, 0.6, 0.62]
      model.openingLeaves.forEach(({ pivot, geometry, sourcePositions }, index) => {
        // Geometry applies its own smooth rotation profile. Feeding it the raw
        // staggered release (instead of another cubic ease) keeps all three
        // flyleaves independently legible during the cascade.
        const leafProgress = clamp01(
          (progress - (leafReleases[index] ?? 0.72)) / (leafDurations[index] ?? 0.28),
        )
        pivot.rotation.y = 0
        updateOpeningLeafGeometry(geometry, sourcePositions, leafProgress, index)
        // Once a leaf has crossed and settled into the left gathering it sits
        // beneath the printed title face. Removing it from the transient draw
        // before the terminal beat prevents a blank flyleaf masking the exact
        // content-bearing handoff page.
        pivot.visible = progress < 0.92 && leafProgress < 0.985
      })

      // Fit the evolving physical bounds after applying the cover and leaf
      // transforms. Target and distance follow the casing, while orientation
      // settles more slowly into the semantic spread's plan view. This keeps
      // the doubled open silhouette contained without crossing to its underside.
      model.root.updateMatrixWorld(true)
      const viewDirection = animatedOffset.clone().normalize()
      const transientPadding = 1.16 + Math.sin(Math.PI * progress) * 0.045
      const fitPadding = MathUtils.lerp(transientPadding, 1.025, smoothstep((progress - 0.8) / 0.18))
      const animatedFit = fitDistanceForObject(model.volume, viewDirection, animatedUp, fitPadding)
      const containmentProgress = smoothstep(progress / 0.2)
      animatedTarget.lerpVectors(openingAnimation.fromTarget, animatedFit.centre, containmentProgress)
      const fittedRadius = MathUtils.lerp(
        openingAnimation.fromSpherical.radius,
        animatedFit.distance,
        containmentProgress,
      )
      animatedOffset.normalize().multiplyScalar(fittedRadius)
      controls.target.copy(animatedTarget)
      camera.position.copy(animatedOffset).add(animatedTarget)
      camera.up.copy(animatedUp)
      camera.lookAt(animatedTarget)

      if (progress >= 1) {
        finishOpening()
      }
    }

    const controlsChanged = controls.update()
    updateCoverArtworkVisibility(camera.position.clone().sub(controls.target))
    renderer.render(scene, camera)
    if ((openingAnimation && openingAnimation.seekProgress === undefined || controlsChanged) && !frame) {
      frame = requestAnimationFrame(renderFrame)
    }
  }

  const requestRender = () => {
    if (!disposed && !frame && !document.hidden) frame = requestAnimationFrame(renderFrame)
  }

  const updateFit = () => {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    const aspect = width / height
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    let outputRatio = resolveBookOutputPixelRatio(quality, width, height)
    renderer.setPixelRatio(outputRatio)
    renderer.setSize(width, height, false)
    const drawingBuffer = renderer.getDrawingBufferSize(new Vector2())
    if (quality.outputTier !== 'adaptive') {
      // Fractional CSS boxes and Three's internal integer size bookkeeping can
      // still leave a nominal 4K surface at 4095 pixels. Measure the actual
      // allocation and make one bounded correction instead of trusting the
      // pre-allocation arithmetic.
      const actualLongEdge = Math.max(drawingBuffer.x, drawingBuffer.y)
      const maxRenderbufferSize = Number(renderer.getContext().getParameter(
        renderer.getContext().MAX_RENDERBUFFER_SIZE,
      ))
      if (actualLongEdge < quality.renderLongEdge && actualLongEdge < maxRenderbufferSize) {
        outputRatio *= (quality.renderLongEdge + 1) / Math.max(1, actualLongEdge)
        renderer.setPixelRatio(outputRatio)
        renderer.setSize(width, height, false)
        renderer.getDrawingBufferSize(drawingBuffer)
      }
    }
    const stage = host.closest<HTMLElement>('.book3d-stage')
    stage?.setAttribute('data-render-width', `${Math.round(drawingBuffer.x)}`)
    stage?.setAttribute('data-render-height', `${Math.round(drawingBuffer.y)}`)

    // The desktop inspection controls occupy a separate rail below this
    // canvas. Orbiting a corner-on volume increases its projected height, so
    // keep enough radial reserve for every azimuth rather than fitting only
    // the front three-quarter pose and letting the spine/fore-edge touch the
    // rail. The opened-state fit is derived independently and is unchanged.
    const closedFit = fitDistanceForObject(model.volume, defaultDirection, camera.up, 1.34)
    target.copy(closedFit.centre)
    fittedDistance = closedFit.distance
    controls.minDistance = fittedDistance * 0.8
    controls.maxDistance = fittedDistance * 1.52

    const currentOffset = camera.position.clone().sub(controls.target)
    if (!hasFittedCamera || currentOffset.length() < fittedDistance * 0.92 || !Number.isFinite(currentOffset.length())) {
      controls.target.copy(target)
      camera.position.copy(defaultDirection).multiplyScalar(fittedDistance).add(controls.target)
      camera.lookAt(controls.target)
    }
    hasFittedCamera = true
    requestRender()
  }

  const resizeObserver = new ResizeObserver(updateFit)
  resizeObserver.observe(host)

  const handleControlsChange = () => {
    reportFace()
    requestRender()
  }
  const handleControlsEnd = () => reportFace()
  controls.addEventListener('change', handleControlsChange)
  controls.addEventListener('end', handleControlsEnd)

  const handleVisibility = () => {
    if (!document.hidden) requestRender()
  }
  document.addEventListener('visibilitychange', handleVisibility)

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    if (!disposed) onContextLost()
  }
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost, { passive: false })

  const settlePendingDamping = () => {
    if (!controls.enableDamping) return
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = true
  }

  const setCameraSpherical = (mutate: (spherical: Spherical) => void) => {
    if (disposed || openingAnimation) return
    settlePendingDamping()
    const offset = camera.position.clone().sub(controls.target)
    const spherical = new Spherical().setFromVector3(offset)
    mutate(spherical)
    spherical.phi = MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle)
    spherical.radius = MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance)
    spherical.makeSafe()
    camera.position.copy(new Vector3().setFromSpherical(spherical).add(controls.target))
    controls.update()
    reportFace()
    requestRender()
  }

  const reset = () => {
    if (disposed || openingAnimation) return
    settlePendingDamping()
    setVolumePosture(0)
    camera.position.copy(defaultDirection).multiplyScalar(fittedDistance).add(target)
    controls.target.copy(target)
    camera.lookAt(target)
    controls.update()
    reportFace()
    requestRender()
  }

  updateFit()
  reportFace()
  const skipClosedFirstFrame = shouldSkipClosedFirstFrame()
  stageElement?.setAttribute('data-initial-frame-status', skipClosedFirstFrame ? 'skipped-for-open' : 'compiling')
  // Compile eagerly, then force the submitted frame below. `compileAsync()`
  // can wait indefinitely on saturated CI GPUs, which is worse than retaining
  // the semantic cover while one synchronous first frame is completed.
  if (!skipClosedFirstFrame) renderer.compile(scene, camera)
  // Prime one lighting pass before revealing UHD. A synchronous `gl.finish()`
  // at a 4096/7680-pixel backing size can block software and low-power GPUs
  // for longer than the entire interaction budget. The two presentation
  // frames below keep the semantic cover in place until a populated canvas
  // has reached the compositor without monopolising the main thread.
  if (!skipClosedFirstFrame) {
    renderer.render(scene, camera)
  }
  // `render()` submits work asynchronously. Do not replace the semantic cover
  // with a nominally ready but still black 4K surface; wait until the first
  // complete frame has actually reached the GPU.
  // GPU completion is not compositor presentation: under UHD load the exact
  // callback screenshot could still be empty even after `gl.finish()`. Keep
  // the semantic cover on top for two browser presentation opportunities,
  // draw again in each, and publish readiness only from the second rAF.
  if (!skipClosedFirstFrame) await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      if (disposed) return resolve()
      renderer.render(scene, camera)
      requestAnimationFrame(() => {
        if (disposed) return resolve()
        renderer.render(scene, camera)
        stageElement?.setAttribute('data-textures-ready', surfaceResult.loaded ? 'true' : 'fallback')
        stageElement?.setAttribute('data-initial-frame-status', 'visible')
        stageElement?.setAttribute('data-initial-frame-ready', 'true')
        onReady()
        resolve()
      })
    })
  })
  else {
    stageElement?.setAttribute('data-textures-ready', surfaceResult.loaded ? 'true' : 'fallback')
    onReady()
  }

  const controller: BookSceneController = {
    open: () => {
      if (openingPromise) return openingPromise
      controls.enabled = false
      controls.enableDamping = false
      controls.update()
      // Fit the actual opened bounds while retaining the reader's current view
      // vector. The target follows the opened casing centre and the radius grows
      // only as much as its projected corners require; no camera-side crossing
      // or underside reveal is possible.
      const openedPose = openedCameraPose()
      const toTarget = openedPose.centre
      const fromSpherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target))
      const toSpherical = new Spherical().setFromVector3(
        openedPose.viewDirection.multiplyScalar(openedPose.distance),
      )
      openingPromise = new Promise<void>((resolve) => {
        const runtimeParameters = new URLSearchParams(window.location.search)
        const debugSlowMotion = runtimeParameters.get('bookMotion') === 'slow'
        const requestedSeekValue = runtimeParameters.get('bookOpeningSeek')
        const requestedSeek = requestedSeekValue === null ? Number.NaN : Number(requestedSeekValue)
        const seekProgress = Number.isFinite(requestedSeek) && requestedSeek >= 0 && requestedSeek < 1
          ? clamp01(requestedSeek)
          : undefined
        const openingDuration = debugSlowMotion ? 20_500 : 2_050
        stageElement?.setAttribute('data-opening-duration', `${openingDuration}`)
        openingAnimation = {
          duration: openingDuration,
          seekProgress,
          startedAt: performance.now(),
          fromSpherical,
          toSpherical,
          thetaDelta: shortestAngleDelta(fromSpherical.theta, toSpherical.theta),
          fromTarget: controls.target.clone(),
          toTarget,
          fromUp: camera.up.clone(),
          toUp: openedPose.up,
          resolve,
        }
        // `requestAnimationFrame` may be heavily throttled while a headless or
        // background WebGL surface compiles. The physical motion remains rAF-
        // driven when frames are available, but the reading state must never
        // remain trapped in `peel` after its advertised duration.
        openingDeadlineTimer = window.setTimeout(finishOpening, openingDuration + 160)
        requestRender()
      })
      return openingPromise
    },
    finishOpening,
    reset,
    rotateBy: (degrees, verticalDegrees = 0) => {
      setCameraSpherical((spherical) => {
        spherical.theta += MathUtils.degToRad(degrees)
        spherical.phi += MathUtils.degToRad(verticalDegrees)
      })
    },
    zoomBy: (factor) => {
      setCameraSpherical((spherical) => {
        spherical.radius *= factor
      })
    },
    setTheme: (nextTheme) => {
      applyTheme(nextTheme)
      requestRender()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(openingDeadlineTimer)
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      controls.removeEventListener('change', handleControlsChange)
      controls.removeEventListener('end', handleControlsEnd)
      controls.dispose()
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
      disposeObject(scene)
      roomEnvironment?.dispose()
      environmentTarget.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }

  return controller
  } catch (error) {
    renderer.renderLists.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    throw error
  }
}
