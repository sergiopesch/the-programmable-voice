import {
  ACESFilmicToneMapping,
  AmbientLight,
  BackSide,
  Color,
  DirectionalLight,
  FrontSide,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three'
import type { Theme } from '../../hooks/usePreferences'
import type { BookSection } from '../../types'
import {
  resolveBookOutputPixelRatio,
  selectBookRenderQuality,
  type BookRenderQuality,
} from '../book3d/bookQuality'
import {
  loadPageDetailTextures,
  type PageDetailTextures,
} from '../book3d/loadBookPbrTextures'
import { BOOK_PAGE_HEIGHT, BOOK_PAGE_WIDTH } from '../book3d/bookGeometry'
import { createDevelopableSheetFrame } from './developableSheet'
import { createPageArtworkTexture } from './createPageArtwork'

export type PageTurnDirection = 'forward' | 'backward'

export interface PageTurnSceneController {
  dispose: () => void
}

interface PageTurnSceneOptions {
  host: HTMLDivElement
  direction: PageTurnDirection
  theme: Theme
  source: BookSection
  target: BookSection
  onComplete: () => void
}

const LEAF_WIDTH = BOOK_PAGE_WIDTH
const LEAF_HEIGHT = BOOK_PAGE_HEIGHT
const TURN_DURATION = 1_080

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function easeInOut(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - ((-2 * value + 2) ** 3) / 2
}

export async function createPageTurnScene({
  host,
  direction,
  theme,
  source,
  target,
  onComplete,
}: PageTurnSceneOptions): Promise<PageTurnSceneController> {
  await document.fonts?.ready
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    premultipliedAlpha: true,
  })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = theme === 'dark' ? 1.18 : 1.12
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.domElement.className = 'page-turn-stage__canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')

  const selectedQuality = selectBookRenderQuality(renderer, host)
  // Eight-kilopixel still inspection belongs to the settled hardback. A
  // travelling leaf is a latency-sensitive transition, so cap its output at
  // native 4K and its transient artwork/PBR maps at 2K. The semantic spread
  // takes over immediately at rest with device-native text.
  const quality: BookRenderQuality = selectedQuality.outputTier === '8k'
    ? {
        ...selectedQuality,
        outputTier: '4k',
        pixelRatio: 1,
        renderLongEdge: 4_096,
        shadowMapSize: 2_048,
        textureTier: '2k',
      }
    : {
        ...selectedQuality,
        shadowMapSize: Math.min(selectedQuality.shadowMapSize, 2_048) as 1024 | 2048,
        textureTier: '2k',
      }
  renderer.setPixelRatio(resolveBookOutputPixelRatio(
    quality,
    Math.max(1, host.clientWidth),
    Math.max(1, host.clientHeight),
  ))
  renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false)
  host.append(renderer.domElement)

  const scene = new Scene()
  const camera = new PerspectiveCamera(28, 1, 0.1, 40)
  const dark = theme === 'dark'
  const stage = host.closest<HTMLElement>('.page-turn-stage')

  scene.add(new HemisphereLight(dark ? '#e8e6e1' : '#fff8ee', dark ? '#161412' : '#2a2622', dark ? 0.55 : 0.7))
  scene.add(new AmbientLight('#efe6d6', dark ? 0.55 : 0.72))
  const key = new DirectionalLight('#fff7ee', dark ? 2.4 : 2.8)
  key.position.set(direction === 'forward' ? 3.2 : -3.2, 6.4, 4.2)
  key.castShadow = true
  key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize)
  scene.add(key)

  let disposed = false
  const artworkSize = 2_048
  // A forward turn lifts the source right page and lands it as the target
  // left page. A reverse turn lifts the source left page and lands it as the
  // target right page, so its face-to-section assignment is inverted.
  const frontSection = direction === 'forward' ? source : target
  const backSection = direction === 'forward' ? target : source
  const frontRole = 'body'
  const backRole = 'title'
  const leftSection = direction === 'forward' ? source : target
  const rightSection = direction === 'forward' ? target : source
  const frontArtwork = createPageArtworkTexture({
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
    mirror: false,
    role: frontRole,
    section: frontSection,
    size: artworkSize,
    theme,
  })
  const backArtwork = createPageArtworkTexture({
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
    mirror: true,
    role: backRole,
    section: backSection,
    size: artworkSize,
    theme,
  })
  const leftArtwork = createPageArtworkTexture({
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
    gutter: 'right',
    mirror: false,
    role: 'title',
    section: leftSection,
    size: artworkSize,
    theme,
  })
  const rightArtwork = createPageArtworkTexture({
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
    gutter: 'left',
    mirror: false,
    role: 'body',
    section: rightSection,
    size: artworkSize,
    theme,
  })
  const paperOptions = {
    color: new Color('#ffffff'),
    roughness: 0.88,
    metalness: 0,
    sheen: 0.22,
    sheenColor: new Color('#fff6e6'),
    sheenRoughness: 0.8,
  }
  const frontPaper = new MeshPhysicalMaterial({ ...paperOptions, map: frontArtwork, side: FrontSide })
  const backPaper = new MeshPhysicalMaterial({ ...paperOptions, map: backArtwork, side: BackSide })
  const leftPaper = new MeshPhysicalMaterial({ ...paperOptions, map: leftArtwork, side: FrontSide })
  const rightPaper = new MeshPhysicalMaterial({ ...paperOptions, map: rightArtwork, side: FrontSide })
  let surfaces: PageDetailTextures | null = null
  const pageAnisotropy = renderer.capabilities.getMaxAnisotropy()
  const loadEffectivePageDetails = async () => {
    try {
      return {
        textures: await loadPageDetailTextures({ anisotropy: pageAnisotropy, tier: quality.textureTier }),
        tier: quality.textureTier,
      }
    } catch (error) {
      if (quality.textureTier !== '4k') throw error
      return {
        textures: await loadPageDetailTextures({ anisotropy: pageAnisotropy, tier: '2k' }),
        tier: '2k' as const,
      }
    }
  }
  void loadEffectivePageDetails().then(({ textures: loaded, tier }) => {
    if (disposed) {
      Object.values(loaded).forEach((texture) => texture.dispose())
      return
    }
    surfaces = loaded
    stage?.setAttribute('data-texture-tier', tier)
    stage?.setAttribute('data-textures-ready', 'true')
    for (const material of [frontPaper, backPaper, leftPaper, rightPaper]) {
      material.normalMap = loaded.paperNormal
      material.normalScale = new Vector2(0.32, 0.32)
      material.roughnessMap = loaded.paperRoughness
      material.needsUpdate = true
    }
  }).catch(() => {
    // The artwork and physical fallback material already carry the turn.
    stage?.setAttribute('data-texture-tier', 'artwork-only')
    stage?.setAttribute('data-textures-ready', 'fallback')
  })

  const geometry = new PlaneGeometry(LEAF_WIDTH, LEAF_HEIGHT, 72, 28)
  const stationaryGeometry = new PlaneGeometry(LEAF_WIDTH, LEAF_HEIGHT, 1, 1)
  const sourcePositions = new Float32Array(geometry.getAttribute('position').array as Float32Array)
  const frontLeaf = new Mesh(geometry, frontPaper)
  const backLeaf = new Mesh(geometry, backPaper)
  const leftPage = new Mesh(stationaryGeometry, leftPaper)
  const rightPage = new Mesh(stationaryGeometry, rightPaper)
  leftPage.position.set(-LEAF_WIDTH / 2, 0, -0.018)
  rightPage.position.set(LEAF_WIDTH / 2, 0, -0.018)
  leftPage.receiveShadow = true
  rightPage.receiveShadow = true
  frontLeaf.castShadow = true
  frontLeaf.receiveShadow = true
  backLeaf.receiveShadow = true
  scene.add(leftPage, rightPage, frontLeaf, backLeaf)

  let frame = 0
  let completed = false
  let startedAt: number | null = null
  const seekValue = new URLSearchParams(window.location.search).get('pageTurnSeek')
  const requestedSeek = seekValue === null ? Number.NaN : Number(seekValue)
  const seekProgress = Number.isFinite(requestedSeek) && requestedSeek >= 0 && requestedSeek < 1
    ? requestedSeek
    : null
  stage?.setAttribute('data-output-tier', quality.outputTier)
  stage?.setAttribute('data-texture-tier', 'pending')
  stage?.setAttribute('data-texture-tier-requested', quality.textureTier)
  stage?.setAttribute('data-textures-ready', 'false')
  stage?.setAttribute('data-selected-output-tier', selectedQuality.outputTier)
  stage?.setAttribute('data-selected-texture-tier', selectedQuality.textureTier)
  stage?.setAttribute('data-page-turn-front-role', frontRole)
  stage?.setAttribute('data-page-turn-back-role', backRole)
  stage?.setAttribute('data-page-turn-front-section', frontSection.id)
  stage?.setAttribute('data-page-turn-back-section', backSection.id)
  stage?.setAttribute('data-page-turn-left-section', leftSection.id)
  stage?.setAttribute('data-page-turn-right-section', rightSection.id)
  stage?.setAttribute('data-page-turn-theme', theme)

  const fit = () => {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    const ratio = resolveBookOutputPixelRatio(quality, width, height)
    renderer.setPixelRatio(ratio)
    renderer.setSize(width, height, false)
    const drawingBuffer = renderer.getDrawingBufferSize(new Vector2())
    if (quality.outputTier !== 'adaptive') {
      const actualLongEdge = Math.max(drawingBuffer.x, drawingBuffer.y)
      const maxRenderbufferSize = Number(renderer.getContext().getParameter(
        renderer.getContext().MAX_RENDERBUFFER_SIZE,
      ))
      if (actualLongEdge < quality.renderLongEdge && actualLongEdge < maxRenderbufferSize) {
        const correctedRatio = ratio * (quality.renderLongEdge + 1) / Math.max(1, actualLongEdge)
        renderer.setPixelRatio(correctedRatio)
        renderer.setSize(width, height, false)
        renderer.getDrawingBufferSize(drawingBuffer)
      }
    }
    stage?.setAttribute('data-render-width', String(drawingBuffer.x))
    stage?.setAttribute('data-render-height', String(drawingBuffer.y))
    const verticalFov = MathUtils.degToRad(camera.fov)
    const verticalDistance = (LEAF_HEIGHT * 1.08 / 2) / Math.tan(verticalFov / 2)
    const horizontalDistance = (LEAF_WIDTH * 2.12 / 2) / (Math.tan(verticalFov / 2) * camera.aspect)
    const distance = Math.max(verticalDistance, horizontalDistance)
    camera.position.set(0, 0.04, distance)
    camera.lookAt(0, 0, 0)
  }

  const deform = (progress: number) => {
    const directed = direction === 'forward' ? progress : 1 - progress
    const frameState = createDevelopableSheetFrame({
      width: LEAF_WIDTH,
      height: LEAF_HEIGHT,
      progress: directed,
      curl: 0.4,
      leadingCorner: direction === 'forward' ? 'top' : 'bottom',
    })
    const position = geometry.getAttribute('position')
    for (let index = 0; index < position.count; index += 1) {
      const offset = index * 3
      const restX = sourcePositions[offset] ?? 0
      const restY = sourcePositions[offset + 1] ?? 0
      const u = MathUtils.clamp(restX + LEAF_WIDTH / 2, 0, LEAF_WIDTH)
      const mapped = frameState.position({ u, v: restY })
      position.setXYZ(index, mapped.x, mapped.y, mapped.z)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
  }

  const finish = () => {
    if (completed || disposed) return
    completed = true
    stage?.setAttribute('data-page-turn-progress', '1.000')
    onComplete()
  }

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    finish()
  }
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost)

  const renderFrame = (now: number) => {
    frame = 0
    if (disposed || document.hidden) return
    if (startedAt === null) startedAt = now
    const progress = seekProgress ?? clamp01((now - startedAt) / TURN_DURATION)
    const eased = easeInOut(progress)
    deform(eased)
    renderer.domElement.style.opacity = '1'
    stage?.setAttribute('data-page-turn-progress', eased.toFixed(3))
    stage?.setAttribute('data-page-turn-phase', progress < 0.16
      ? 'pickup'
      : progress < 0.58
        ? 'cross'
        : progress < 0.9
          ? 'land'
          : 'settle')
    renderer.render(scene, camera)
    if (seekProgress !== null) return
    if (progress >= 1) {
      finish()
      return
    }
    frame = requestAnimationFrame(renderFrame)
  }

  fit()
  deform(direction === 'forward' ? 0 : 1)
  const resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(host)
  frame = requestAnimationFrame(renderFrame)
  const safety = seekProgress === null
    ? window.setTimeout(finish, TURN_DURATION + 600)
    : 0

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      window.clearTimeout(safety)
      if (frame) cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
      geometry.dispose()
      stationaryGeometry.dispose()
      frontArtwork.dispose()
      backArtwork.dispose()
      leftArtwork.dispose()
      rightArtwork.dispose()
      frontPaper.dispose()
      backPaper.dispose()
      leftPaper.dispose()
      rightPaper.dispose()
      if (surfaces) Object.values(surfaces).forEach((texture) => texture.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
