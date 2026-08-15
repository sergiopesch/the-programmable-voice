import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  FrontSide,
  ShadowMaterial,
  Vector2,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { BookTextures } from './createBookTextures'
import type { BookSurfaceTextures } from './loadBookPbrTextures'
import {
  BOOK_GEOMETRY,
  BOOK_PAGE_HEIGHT,
  BOOK_PAGE_WIDTH,
} from './bookGeometry'

export interface BookModel {
  root: Group
  /** All physical parts except the studio shadow receiver. */
  volume: Group
  frontCoverPivot: Group
  frontArtwork: Mesh
  backArtwork: Mesh
  openingPageBlockPivot: Group
  openingLeaves: OpeningLeaf[]
}

export interface OpeningLeaf {
  pivot: Group
  geometry: PlaneGeometry
  sourcePositions: Float32Array
}

const BOOK_WIDTH = BOOK_GEOMETRY.boardWidth
const BOOK_HEIGHT = BOOK_GEOMETRY.boardHeight
const PAGE_DEPTH = BOOK_GEOMETRY.pageBlockDepth
const BOARD_DEPTH = BOOK_GEOMETRY.boardDepth

export function createBookModel(textures: BookTextures, initialSurfaces: BookSurfaceTextures): BookModel {
  const root = new Group()
  root.name = 'physical-book'

  const cloth = new MeshPhysicalMaterial({
    // The photographed cloth albedo is already charcoal. Keep the tint
    // neutral enough that ACES lighting can reveal its weave and debossing
    // instead of multiplying the surface down to near-black.
    color: '#7a7f82',
    map: initialSurfaces.clothColor,
    emissive: '#2a2c2e',
    emissiveIntensity: 0.42,
    normalMap: initialSurfaces.clothNormal,
    normalScale: new Vector2(1.18, 1.18),
    aoMap: initialSurfaces.clothArm,
    aoMapIntensity: 0.16,
    roughnessMap: initialSurfaces.clothArm,
    roughness: 0.9,
    metalness: 0,
    sheen: 0.22,
    sheenColor: '#b7b1a6',
    sheenRoughness: 0.84,
  })
  // The rear board faces the studio key at the strongest angle in inspection
  // view. A separately calibrated tint preserves the same charcoal identity
  // instead of letting that face wash out to slate grey.
  const rearCloth = cloth.clone()
  rearCloth.color.set('#5c5550')
  rearCloth.emissive.set('#1a1614')
  rearCloth.emissiveIntensity = 0.22
  rearCloth.roughness = 0.93
  rearCloth.sheen = 0.15
  rearCloth.sheenColor.set('#817d75')
  const spineCloth = new MeshPhysicalMaterial({
    color: '#6b2430',
    emissive: '#3a1218',
    emissiveIntensity: 0.32,
    map: initialSurfaces.clothColor,
    normalMap: initialSurfaces.clothNormal,
    normalScale: new Vector2(0.92, 0.92),
    aoMap: initialSurfaces.clothArm,
    aoMapIntensity: 0.14,
    roughnessMap: initialSurfaces.clothArm,
    roughness: 0.91,
    metalness: 0,
    sheen: 0.07,
    sheenColor: '#4b2026',
    sheenRoughness: 0.91,
    specularIntensity: 0.2,
    specularColor: '#6a3d42',
  })
  const oxblood = new MeshStandardMaterial({
    color: '#57252a',
    normalMap: initialSurfaces.clothNormal,
    normalScale: new Vector2(0.36, 0.36),
    roughnessMap: initialSurfaces.clothArm,
    roughness: 0.88,
    metalness: 0,
  })
  const coverFrontArtwork = new MeshPhysicalMaterial({
    map: textures.coverFront,
    emissive: '#ffffff',
    emissiveMap: textures.coverFront,
    emissiveIntensity: 0.28,
    normalMap: initialSurfaces.clothNormal,
    normalScale: new Vector2(0.72, 0.72),
    roughnessMap: initialSurfaces.clothArm,
    alphaTest: 0.012,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 0.73,
    metalness: 0,
    side: FrontSide,
    transparent: true,
    toneMapped: true,
  })
  const coverBackArtwork = new MeshPhysicalMaterial({
    map: textures.coverBack,
    emissive: '#f0e7d7',
    emissiveMap: textures.coverBack,
    emissiveIntensity: 0.2,
    normalMap: initialSurfaces.clothNormal,
    normalScale: new Vector2(0.72, 0.72),
    roughnessMap: initialSurfaces.clothArm,
    alphaTest: 0.012,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 0.76,
    metalness: 0,
    side: FrontSide,
    transparent: true,
    toneMapped: true,
  })
  const paper = new MeshStandardMaterial({
    color: '#d6c8b2',
    map: initialSurfaces.paperColor,
    normalMap: initialSurfaces.paperNormal,
    normalScale: new Vector2(0.22, 0.22),
    roughnessMap: initialSurfaces.paperRoughness,
    roughness: 0.94,
    metalness: 0,
  })
  const openingLeftPaper = new MeshStandardMaterial({
    color: '#fffdf7',
    map: textures.openingLeft,
    normalMap: initialSurfaces.paperNormal,
    normalScale: new Vector2(0.16, 0.16),
    roughnessMap: initialSurfaces.paperRoughness,
    roughness: 0.94,
    metalness: 0,
    side: FrontSide,
  })
  const openingRightPaper = openingLeftPaper.clone()
  openingRightPaper.map = textures.openingRight
  openingRightPaper.needsUpdate = true
  const pageEdges = new MeshStandardMaterial({
    color: '#d8cab1',
    map: textures.pageEdges,
    normalMap: initialSurfaces.paperNormal,
    normalScale: new Vector2(0.3, 0.3),
    roughnessMap: initialSurfaces.paperRoughness,
    roughness: 0.92,
    metalness: 0,
  })
  const hiddenSpine = new MeshStandardMaterial({
    color: '#8d7762',
    roughness: 0.96,
    metalness: 0,
  })

  const pageWidth = BOOK_PAGE_WIDTH
  const pageHeight = BOOK_PAGE_HEIGHT
  const pageBlockGeometry = new BoxGeometry(pageWidth - 0.1, pageHeight, PAGE_DEPTH, 1, 1, 20)
  const pageBlock = new Mesh(
    pageBlockGeometry,
    [pageEdges, hiddenSpine, pageEdges, pageEdges, paper, paper],
  )
  pageBlock.name = 'layered-page-block'
  pageBlock.position.x = 0.005
  pageBlock.castShadow = true
  pageBlock.receiveShadow = true
  root.add(pageBlock)

  // A slim front gathering follows the casing as the book opens. The main
  // block remains on the right, while this articulated section forms the
  // shallow stack visible beneath the newly opened left flyleaves.
  const openingPageBlockPivot = new Group()
  openingPageBlockPivot.name = 'opening-page-gathering-hinge'
  openingPageBlockPivot.position.set(-pageWidth / 2 + 0.055, 0, PAGE_DEPTH / 2 - 0.036)
  const openingPageBlock = new Mesh(
    new BoxGeometry(pageWidth, pageHeight, 0.045, 1, 1, 5),
    [pageEdges, hiddenSpine, pageEdges, pageEdges, paper, paper],
  )
  openingPageBlock.name = 'opening-page-gathering'
  openingPageBlock.position.x = pageWidth / 2
  openingPageBlock.castShadow = true
  openingPageBlock.receiveShadow = true
  openingPageBlockPivot.add(openingPageBlock)
  root.add(openingPageBlockPivot)

  const foreEdge = new Mesh(
    new CylinderGeometry(PAGE_DEPTH / 2, PAGE_DEPTH / 2, pageHeight, 48, 1, false),
    pageEdges,
  )
  foreEdge.name = 'rounded-fore-edge'
  foreEdge.position.x = pageWidth / 2 - 0.055
  foreEdge.scale.x = 0.21
  foreEdge.castShadow = true
  foreEdge.receiveShadow = true
  root.add(foreEdge)

  const backBoard = new Mesh(
    new RoundedBoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, BOARD_DEPTH, 9, 0.07),
    rearCloth,
  )
  backBoard.name = 'rear-board'
  backBoard.position.z = -(PAGE_DEPTH + BOARD_DEPTH) / 2
  backBoard.castShadow = true
  backBoard.receiveShadow = true
  root.add(backBoard)

  const backArtwork = new Mesh(new PlaneGeometry(BOOK_WIDTH * 0.958, BOOK_HEIGHT * 0.969), coverBackArtwork)
  backArtwork.name = 'rear-cover-artwork'
  backArtwork.position.z = backBoard.position.z - BOARD_DEPTH / 2 - 0.014
  backArtwork.rotation.y = Math.PI
  backArtwork.castShadow = true
  root.add(backArtwork)

  const frontCoverDepth = (PAGE_DEPTH + BOARD_DEPTH) / 2
  const frontCoverPivot = new Group()
  frontCoverPivot.name = 'front-cover-hinge'
  frontCoverPivot.position.set(-BOOK_WIDTH / 2, 0, frontCoverDepth)
  root.add(frontCoverPivot)

  const frontBoard = new Mesh(
    new RoundedBoxGeometry(BOOK_WIDTH, BOOK_HEIGHT, BOARD_DEPTH, 9, 0.07),
    cloth,
  )
  frontBoard.name = 'front-board'
  frontBoard.position.set(BOOK_WIDTH / 2, 0, 0)
  frontBoard.castShadow = true
  frontBoard.receiveShadow = true
  frontCoverPivot.add(frontBoard)

  const frontArtwork = new Mesh(new PlaneGeometry(BOOK_WIDTH * 0.95, BOOK_HEIGHT * 0.962), coverFrontArtwork)
  frontArtwork.name = 'front-cover-artwork'
  frontArtwork.position.set(
    BOOK_WIDTH / 2,
    0,
    BOARD_DEPTH / 2 + 0.014,
  )
  frontArtwork.castShadow = true
  frontCoverPivot.add(frontArtwork)

  const frontEndpaper = new Mesh(
    new PlaneGeometry(BOOK_WIDTH * 0.953, BOOK_HEIGHT * 0.963),
    new MeshStandardMaterial({ color: '#431a1e', roughness: 0.94, side: DoubleSide }),
  )
  frontEndpaper.name = 'oxblood-front-endpaper'
  frontEndpaper.position.set(
    BOOK_WIDTH / 2,
    0,
    -BOARD_DEPTH / 2 - 0.005,
  )
  frontEndpaper.rotation.y = Math.PI
  frontEndpaper.receiveShadow = true
  frontCoverPivot.add(frontEndpaper)

  // These are the same title and prologue faces that the semantic spread
  // reveals at handoff. Printing them on the physical leaves removes the
  // blank-WebGL-to-typeset-DOM flash at the end of the opening gesture.
  const openingLeftPage = new Mesh(
    new PlaneGeometry(pageWidth, pageHeight),
    openingLeftPaper,
  )
  openingLeftPage.name = 'opening-title-page'
  openingLeftPage.position.set(BOOK_WIDTH / 2, 0, -BOARD_DEPTH / 2 - 0.009)
  openingLeftPage.rotation.y = Math.PI
  openingLeftPage.receiveShadow = true
  frontCoverPivot.add(openingLeftPage)

  const openingRightPage = new Mesh(
    new PlaneGeometry(pageWidth, pageHeight),
    openingRightPaper,
  )
  openingRightPage.name = 'opening-prologue-page'
  openingRightPage.position.set(0.055, 0, PAGE_DEPTH / 2 + 0.004)
  openingRightPage.receiveShadow = true
  root.add(openingRightPage)

  const rearEndpaper = new Mesh(
    new PlaneGeometry(BOOK_WIDTH * 0.953, BOOK_HEIGHT * 0.963),
    new MeshStandardMaterial({ color: '#431a1e', roughness: 0.94, side: DoubleSide }),
  )
  rearEndpaper.name = 'oxblood-rear-endpaper'
  rearEndpaper.position.z = backBoard.position.z + BOARD_DEPTH / 2 + 0.005
  rearEndpaper.receiveShadow = true
  root.add(rearEndpaper)

  const spine = new Mesh(
    new CylinderGeometry(PAGE_DEPTH * 0.65, PAGE_DEPTH * 0.65, BOOK_HEIGHT * 0.985, 48, 1, false),
    spineCloth,
  )
  spine.name = 'rounded-cloth-spine'
  spine.position.x = -BOOK_WIDTH / 2 + 0.01
  spine.scale.x = 0.44
  spine.castShadow = true
  spine.receiveShadow = true
  root.add(spine)

  // Keep the typographic panel off the cylinder UV seam. A dedicated tangent
  // decal preserves the complete title and behaves like a real spine stamp.
  const spineLabelMaterial = new MeshPhysicalMaterial({
    map: textures.coverSpine,
    color: '#fff4d8',
    emissive: '#f0d9a8',
    emissiveMap: textures.coverSpine,
    emissiveIntensity: 0.22,
    normalMap: initialSurfaces.clothNormal,
    normalScale: new Vector2(0.22, 0.22),
    roughness: 0.88,
    metalness: 0,
    alphaTest: 0.035,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: FrontSide,
    transparent: true,
  })
  const spineLabel = new Mesh(
    new PlaneGeometry(PAGE_DEPTH * 0.6, BOOK_HEIGHT * 0.92),
    spineLabelMaterial,
  )
  spineLabel.name = 'dedicated-spine-title'
  spineLabel.position.set(
    -BOOK_WIDTH / 2 - PAGE_DEPTH * 0.65 * 0.44 - 0.008,
    0,
    0,
  )
  spineLabel.rotation.y = -Math.PI / 2
  spineLabel.castShadow = true
  root.add(spineLabel)

  const hingeGeometry = new CylinderGeometry(0.045, 0.045, BOOK_HEIGHT * 0.93, 16)
  const frontHinge = new Mesh(hingeGeometry, oxblood)
  frontHinge.name = 'front-hinge-channel'
  frontHinge.position.set(-BOOK_WIDTH / 2 + 0.16, 0, PAGE_DEPTH / 2 + BOARD_DEPTH * 0.68)
  frontHinge.castShadow = true
  root.add(frontHinge)

  const rearHinge = new Mesh(hingeGeometry.clone(), oxblood)
  rearHinge.name = 'rear-hinge-channel'
  rearHinge.position.set(-BOOK_WIDTH / 2 + 0.16, 0, -(PAGE_DEPTH / 2 + BOARD_DEPTH * 0.68))
  rearHinge.castShadow = true
  root.add(rearHinge)

  const headbandGeometry = new CylinderGeometry(0.055, 0.055, PAGE_DEPTH * 0.84, 16)
  const headbandMaterial = new MeshStandardMaterial({ color: '#7d3539', roughness: 0.8 })
  const headbandTop = new Mesh(headbandGeometry, headbandMaterial)
  headbandTop.name = 'headband-top'
  headbandTop.position.set(-BOOK_WIDTH / 2 + 0.18, BOOK_HEIGHT / 2 - 0.07, 0)
  headbandTop.rotation.x = Math.PI / 2
  headbandTop.castShadow = true
  root.add(headbandTop)

  const headbandBottom = new Mesh(headbandGeometry.clone(), headbandMaterial)
  headbandBottom.name = 'headband-bottom'
  headbandBottom.position.set(-BOOK_WIDTH / 2 + 0.18, -BOOK_HEIGHT / 2 + 0.07, 0)
  headbandBottom.rotation.x = Math.PI / 2
  headbandBottom.castShadow = true
  root.add(headbandBottom)

  const sliverMaterial = new MeshStandardMaterial({
    color: '#f5ecdb',
    roughness: 0.88,
    transparent: true,
    opacity: 0.62,
    side: DoubleSide,
  })
  const sliverGeometry = new PlaneGeometry(PAGE_DEPTH * 0.035, pageHeight * 0.965)
  const sliverCount = 52
  const slivers = new InstancedMesh(sliverGeometry, sliverMaterial, sliverCount)
  slivers.name = 'fore-edge-page-slivers'
  const matrix = new Matrix4()
  const sliverPosition = new Vector3()
  for (let index = 0; index < sliverCount; index += 1) {
    const progress = index / (sliverCount - 1)
    sliverPosition.set(
      pageWidth / 2 + 0.02 + Math.sin(index * 1.71) * 0.006,
      ((index % 5) - 2) * 0.0022,
      -PAGE_DEPTH / 2 + PAGE_DEPTH * progress,
    )
    matrix.makeRotationY(Math.PI / 2)
    matrix.setPosition(sliverPosition)
    slivers.setMatrixAt(index, matrix)
  }
  slivers.instanceMatrix.needsUpdate = true
  slivers.castShadow = true
  root.add(slivers)

  const headTailGeometry = new PlaneGeometry(pageWidth * 0.965, PAGE_DEPTH * 0.018)
  const headTailSlivers = new InstancedMesh(headTailGeometry, sliverMaterial, 18)
  headTailSlivers.name = 'head-tail-page-slivers'
  for (let index = 0; index < 18; index += 1) {
    const atTop = index < 9
    const layer = index % 9
    matrix.makeRotationX(Math.PI / 2)
    matrix.setPosition(
      0.035 + Math.sin(index * 0.91) * 0.004,
      (atTop ? 1 : -1) * (pageHeight / 2 + 0.004 + layer * 0.0007),
      -PAGE_DEPTH / 2 + (layer / 8) * PAGE_DEPTH,
    )
    headTailSlivers.setMatrixAt(index, matrix)
  }
  headTailSlivers.instanceMatrix.needsUpdate = true
  headTailSlivers.castShadow = true
  root.add(headTailSlivers)

  const openingLeaves: OpeningLeaf[] = []
  for (let index = 0; index < 3; index += 1) {
    const pivot = new Group()
    pivot.name = `opening-leaf-${index + 1}`
    pivot.position.set(-pageWidth / 2 + 0.055, 0, PAGE_DEPTH / 2 + 0.018 - index * 0.004)
    const leafMaterial = new MeshStandardMaterial({
      color: index === 0 ? '#cfc1aa' : '#d6c9b4',
      map: initialSurfaces.paperColor,
      normalMap: initialSurfaces.paperNormal,
      normalScale: new Vector2(0.18, 0.18),
      roughnessMap: initialSurfaces.paperRoughness,
      roughness: 0.95,
      metalness: 0,
      side: DoubleSide,
    })
    const leafGeometry = new PlaneGeometry(pageWidth, pageHeight, 96, 24)
    const leaf = new Mesh(leafGeometry, leafMaterial)
    leaf.position.x = pageWidth / 2
    leaf.castShadow = true
    leaf.receiveShadow = true
    pivot.add(leaf)
    root.add(pivot)
    const position = leafGeometry.getAttribute('position')
    openingLeaves.push({
      pivot,
      geometry: leafGeometry,
      sourcePositions: new Float32Array(position.array as Float32Array),
    })
  }

  const ground = new Mesh(
    new PlaneGeometry(64, 64),
    new ShadowMaterial({ color: '#050505', opacity: 0.34 }),
  )
  ground.name = 'contact-shadow-receiver'
  ground.position.set(0, -(PAGE_DEPTH + BOARD_DEPTH * 2) / 2 - 0.03, 0.7)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  root.add(ground)

  const volume = new Group()
  volume.name = 'cinematic-bound-volume'
  const physicalChildren = root.children.filter((child) => child !== ground)
  physicalChildren.forEach((child) => volume.add(child))
  volume.rotation.set(-1.38, 0, -0.085)
  root.add(volume)
  volume.updateMatrixWorld(true)
  const volumeBounds = new Box3().setFromObject(volume)
  volume.position.y += ground.position.y + 0.045 - volumeBounds.min.y

  return {
    root,
    volume,
    frontCoverPivot,
    frontArtwork,
    backArtwork,
    openingPageBlockPivot,
    openingLeaves,
  }
}
