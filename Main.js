var g_Camera, g_Scene, g_Renderer;
var g_main3dObject;
var g_SwappingGrid;
var g_OrthoCameraControl;
var g_animationFrameId;
var g_PerspectiveCamera;
var g_OrthographicCamera;
var g_datGui;

var options = {
  isPerspective: true,
  backgroundColor: "#ffffff",
};

function show3DScene() {
  if (g_Scene == null) {
    init();
    render();
  }
}

function init() {
  const canvas = document.getElementById("c");
  canvas.style.visibility = "visible";

  g_Renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
  });

  g_Scene = new THREE.Scene();
  g_Scene.background = new THREE.Color(options.backgroundColor);

  g_main3dObject = draw3DObject();

  // LIGHTS - needed for phong shading.
  var light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.setScalar(100);
  g_Scene.add(light);
  g_Scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  // Origin
  var axesHelper = new THREE.AxesHelper(1);
  g_Scene.add(axesHelper);
  CommonUtilities.DrawPoint(new THREE.Vector3(), g_Scene);

  setOrthoAndPerspectiveCameras(canvas);
  addSceneOptions();
  addSwappingGridAroundmainObject();
}

function setOrthoAndPerspectiveCameras(canvas) {
  g_OrthographicCamera = new THREE.OrthographicCamera(
    canvas.offsetWidth / -60,
    canvas.offsetWidth / 60,
    canvas.offsetHeight / 60,
    canvas.offsetHeight / -60,
    1,
    20000
  );
  g_PerspectiveCamera = new THREE.PerspectiveCamera(
    70,
    canvas.offsetWidth / canvas.offsetHeight,
    1,
    20000
  );
  g_Camera = g_PerspectiveCamera;

  // This is to set the proper position of the camera
  g_main3dObject.geometry.computeBoundingBox();
  let mainBoundingBox = g_main3dObject.geometry.boundingBox;
  let distance = mainBoundingBox.getSize().length();
  //distance *= 0.001;   // convert in KM, factor it for proper positioning.

  g_OrthographicCamera.position.y = -distance;
  g_OrthographicCamera.position.z = distance;
  g_OrthographicCamera.up.x = 0;
  g_OrthographicCamera.up.y = 0;
  g_OrthographicCamera.up.z = 1;

  g_PerspectiveCamera.position.y = -distance;
  g_PerspectiveCamera.position.z = distance;
  g_PerspectiveCamera.up.x = 0;
  g_PerspectiveCamera.up.y = 0;
  g_PerspectiveCamera.up.z = 1;

  // Add orbit control. http://jsfiddle.net/Stemkoski/ddbTy/
  g_OrthoCameraControl = new THREE.OrbitControls(
    g_OrthographicCamera,
    g_Renderer.domElement
  );
  g_OrthoCameraControl.target.set(0, 0, -2);
  g_PerspCameraControl = new THREE.OrbitControls(
    g_PerspectiveCamera,
    g_Renderer.domElement
  );
  g_PerspCameraControl.target.set(0, 0, -2);

  g_OrthoCameraControl.addEventListener("change", onCameraPositionChange);

  g_PerspCameraControl.addEventListener("change", onCameraPositionChange);

  g_OrthographicCamera.lookAt(new THREE.Vector3(0, 0, -2));
  g_PerspectiveCamera.lookAt(new THREE.Vector3(0, 0, -2));

  switchBetweenOrthoAndPersp();
}

function resize(renderer) {
  const canvas = renderer.domElement;
  // canvas.style.width ='100%';
  // canvas.style.height='100%';
  // canvas.width  = canvas.offsetWidth;
  // canvas.height = canvas.offsetHeight;
  const width = canvas.clientWidth;
  const height = window.innerHeight - 5;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

function render() {
  if (resize(g_Renderer)) {
    const canvas = g_Renderer.domElement;
    g_Camera.aspect = canvas.clientWidth / canvas.clientHeight;
    g_Camera.updateProjectionMatrix();
  }
  g_Renderer.render(g_Scene, g_Camera);

  g_animationFrameId = requestAnimationFrame(render);
}

function switchBetweenOrthoAndPersp() {
  if (options.isPerspective) {
    g_Camera = g_PerspectiveCamera;
  } else {
    g_Camera = g_OrthographicCamera;
  }
}

function addSceneOptions() {
  let datGuiFolder = getDatUIFor3D().addFolder("Scene Options");
  datGuiFolder
    .addColor(options, "backgroundColor")
    .name("Background")
    .onChange(() => {
      g_Scene.background = new THREE.Color(options.backgroundColor);
    });
  datGuiFolder
    .add(options, "isPerspective")
    .name("Perspective")
    .onChange(switchBetweenOrthoAndPersp);
}

function draw3DObject() {
  geom = new THREE.BoxGeometry(10, 10, 4);

  const meshObject = new THREE.Mesh(
    geom,
    new THREE.MeshBasicMaterial({
      wireframe: false,
      side: THREE.FrontSide,
      opacity: 0.6,
      transparent: true,
      color: "#10A5F5", // Light Blue
    })
  );

  g_Scene.add(meshObject);

  const datGui = getDatUIFor3D();
  let mainObjectUI = datGui.addFolder("3D Object");
  mainObjectUI.add(meshObject.material, "wireframe").name("Wireframe");
  mainObjectUI.add(meshObject, "visible").name("Visible");
  mainObjectUI
    .add(meshObject.material, "opacity")
    .min(0.0)
    .max(1)
    .step(0.1)
    .name("Opacity");

  return meshObject;
}

function getBoundingBoxOfmainObject() {
  // Get bounds of the mainObject which is going to be inside this grid.
  g_main3dObject.geometry.computeBoundingBox();
  let mainObjectBoundingBox = g_main3dObject.geometry.boundingBox;
  let bbSizeVec = new THREE.Vector3();
  mainObjectBoundingBox.getSize(bbSizeVec);
  let bbCenter = new THREE.Vector3();
  mainObjectBoundingBox.getCenter(bbCenter);
  // We need slightly larger grid than the mainObject.
  const size = Math.max(bbSizeVec.x, bbSizeVec.y, bbSizeVec.z) * 1.2;
  // adjust the bbBox as per max size so as to position the mainObject nicely in the center.
  mainObjectBoundingBox.setFromCenterAndSize(
    bbCenter,
    new THREE.Vector3(size, size, 0)
  );
  // We want the mainObject around top of the grid. So we need to expand the bounding box depth.
  mainObjectBoundingBox.min.setZ(mainObjectBoundingBox.min.z - 0.9 * size);

  return mainObjectBoundingBox;
}

function addSwappingGridAroundmainObject() {
  const mainObjectBoundingBox = getBoundingBoxOfmainObject();

  g_SwappingGrid = new SwappingGrid(g_Scene);
  g_SwappingGrid.addReferenceGrids(mainObjectBoundingBox);
  g_SwappingGrid.cameraChanged(g_Camera, true);

  const datGui = getDatUIFor3D();
  const gridUI = datGui.addFolder("Grid");
  gridUI.add(g_SwappingGrid.userOptions, "gridSwap").name("Swapping On");
  gridUI.add(g_SwappingGrid.userOptions, "animateGrid").name("Animated");
  gridUI
    .add(g_SwappingGrid.userOptions, "showDivisions")
    .name("Show Divisions (ft)")
    .onChange(function () {
      g_SwappingGrid.redrawTheAxisTriad();
    });
}

function onCameraPositionChange(e) {
  if (g_SwappingGrid) {
    g_SwappingGrid.cameraChanged(g_Camera);
  }
}

function getDatUIFor3D() {
  // DAT UI controls.
  if (g_datGui == null) {
    g_datGui = new dat.GUI();
    const graphicDivElement = document.getElementById("dat-gui-container");
    graphicDivElement.appendChild(g_datGui.domElement);
  }
  return g_datGui;
}
