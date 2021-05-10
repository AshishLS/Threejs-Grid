// Developed by Ashish Shete. Free to use. Date - 9th May 2021

class SwappingGrid {

    constructor(scene) {
        this.mUserOptions = { gridSwap: true, animateGrid: true, showDivisions: true };
        this.scene = scene;
        this.gridColor = 0x444444
        this.divisions = 10;
        this.font = null;
        this.camera = null;
    }

    set userOptions(value) {
        this.mUserOptions.gridSwap = value;
    }

    get userOptions() {
        return this.mUserOptions;
    }

    get gridObject3D() {
        return this.mGridObject3D;
    }

    addReferenceGrids(boundingBox) {

        let bbSizeVec = new THREE.Vector3();
        boundingBox.getSize(bbSizeVec);
        this.boundingBoxCenter = new THREE.Vector3();
        boundingBox.getCenter(this.boundingBoxCenter);

        const size = Math.max(bbSizeVec.x, bbSizeVec.y, bbSizeVec.z);
        const halfSize = size * 0.5;

        // create a grid object which will hold these three grids.
        this.mGridObject3D = new THREE.Object3D();
        this.scene.add(this.mGridObject3D);

        // Draw a point at the center of the origin.
        var gridOrigin = CommonUtilities.DrawPoint(this.mGridObject3D.position.clone(), this.mGridObject3D);
        gridOrigin.name = "GridOrigin";

        // Default plane is XZ
        {
            // Create a grid and a same size mesh as well so that we can have intersetection information easily.
            let gridHelperXY = new THREE.GridHelper(size, this.divisions, this.gridColor, this.gridColor);
            gridHelperXY.geometry.rotateX(Math.PI / 2);
            gridHelperXY.geometry.translate(halfSize, halfSize, 0);
            gridHelperXY.name = "XY";
            gridHelperXY.userData = { plane: 'XY', direction: new THREE.Vector3(0, 0, 1), size: size };
            this.mGridObject3D.add(gridHelperXY);
        }

        {
            let gridHelperXZ = new THREE.GridHelper(size, this.divisions, this.gridColor, this.gridColor);
            gridHelperXZ.geometry.translate(halfSize, 0, halfSize);
            gridHelperXZ.name = "XZ";
            gridHelperXZ.userData = { plane: 'XZ', direction: new THREE.Vector3(0, 1, 0), size: size };
            this.mGridObject3D.add(gridHelperXZ);
        }

        {
            let gridHelperYZ = new THREE.GridHelper(size, this.divisions, this.gridColor, this.gridColor);
            gridHelperYZ.geometry.rotateZ(Math.PI / 2);
            gridHelperYZ.geometry.translate(0, halfSize, halfSize);
            gridHelperYZ.name = "YZ";
            gridHelperYZ.userData = { plane: 'YZ', direction: new THREE.Vector3(1, 0, 0), size: size };
            this.mGridObject3D.add(gridHelperYZ);
        }

        // So we want to place this grid around the terrain. The grid is at the origin now.
        // Translate to the min point of the terrain.
        let translateDirection = new THREE.Vector3();
        translateDirection.subVectors(boundingBox.min, this.mGridObject3D.position)
        let distBetweenGridAndMin = translateDirection.length();
        translateDirection.normalize();

        this.mGridObject3D.translateOnAxis(translateDirection, distBetweenGridAndMin);
        this.mGridObject3D.updateMatrixWorld();

        // Load the font for labels.
        const that = this;
        this.loadFont().then(result => {
            that.font = result;
            that.redrawTheAxisTriad();
        });
    }

    cameraChanged(camera, forceNoAnimation=false) {

        this.camera = camera;
        // For Grid Swapping 
        if (this.mGridObject3D && this.mUserOptions.gridSwap) {
            let rayDirection = new THREE.Vector3();
            rayDirection.subVectors(this.boundingBoxCenter, this.camera.position);
            let farDistForRaycaster = rayDirection.length();
            rayDirection.normalize();
            let raycaster = new THREE.Raycaster(this.camera.position, rayDirection);
            raycaster.far = farDistForRaycaster; // We don't want the raycaster to find objects till infinity.

            // calculate objects intersecting the picking ray - Check on grid object.
            var intersects = raycaster.intersectObjects(this.mGridObject3D.children);

            for (var i = 0; i < intersects.length; i++) {
                // Check if this object is a grid plane.
                if (intersects[i].object.userData.plane) {
                    let gridPlaneObj = intersects[i].object;

                    if (!forceNoAnimation && this.mUserOptions.animateGrid) {
                        let previousInProgress = this.swapThisGridSmoothly(gridPlaneObj);
                        if (previousInProgress)
                            continue;
                    }
                    else
                        gridPlaneObj.translateOnAxis(gridPlaneObj.userData.direction, gridPlaneObj.userData.size);

                    let gridOrigin = this.mGridObject3D.getObjectByName("GridOrigin");
                    gridOrigin.translateOnAxis(gridPlaneObj.userData.direction, gridPlaneObj.userData.size);

                    gridPlaneObj.userData.direction.multiplyScalar(-1); // Reverse the stored direction because it's been moved.
                    this.redrawTheAxisTriad();

                    //gridPlaneObj.material.color.set(0xff0000);
                    //console.log(gridPlaneObj.id);
                }
            }
        }
        this.realignLabelsToFaceCamera();
    }

    realignLabelsToFaceCamera() {
        let labelObjectNames = ["X-Axis" + "Label", "Y-Axis" + "Label", "Z-Axis" + "Label"];
        for (let labelIndex = 0; labelIndex < labelObjectNames.length; labelIndex++) {
            const labelObjectName = labelObjectNames[labelIndex];

            let labelObject = this.gridObject3D.getObjectByName(labelObjectName);
            if (labelObject) {
                // Label object contains meshes of the labels which need reorientation.
                for (let index = 0; index < labelObject.children.length; index++) {
                    const child = labelObject.children[index];
                    child.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
                }
            }
        }
    }

    redrawTheAxisTriad() {
        this.reDrawAxisAndLabel("X-Axis", "YZ", 0xff0000);
        this.reDrawAxisAndLabel("Y-Axis", "XZ", 0x00ff00);
        this.reDrawAxisAndLabel("Z-Axis", "XY", 0x0000ff);
    }

    reDrawAxisAndLabel(axisName, planeName, color) {
        // we need to draw from grid's changed origin
        let gridOrigin = this.mGridObject3D.getObjectByName("GridOrigin");
        if (gridOrigin) {
            let gridOrgiPosition = gridOrigin.position.clone();
            let plane = this.mGridObject3D.getObjectByName(planeName);
            let axisDirection = plane.userData.direction.clone();
            let axisLength = plane.userData.size * 1.3;

            // Redraw the Axis.
            this.drawAxisArrow(axisName, axisDirection, axisLength, gridOrgiPosition, color);
            // Redraw the Lebel
            this.drawAxisLabel(axisName, axisDirection, axisLength, gridOrgiPosition, color, plane.userData.size);
            this.mGridObject3D.updateMatrixWorld();
        }
    }

    drawAxisArrow(axisName, axisDirection, axisLength, gridOrgiPosition, color) {
        // Remove the existing axis.
        let xAxisLine = this.mGridObject3D.getObjectByName(axisName);
        if (xAxisLine) {
            CommonUtilities.clearThree(xAxisLine);
            this.mGridObject3D.remove(xAxisLine);
            xAxisLine = null;
        }

        var axisLine = new THREE.ArrowHelper(axisDirection, gridOrgiPosition);
        axisLine.setColor(color);
        var coneMaterial = new THREE.MeshLambertMaterial({ color: color, wireframe: false });
        coneMaterial.flatShading = true;
        axisLine.cone.material = coneMaterial;

        axisLine.setLength(axisLength, axisLength * 0.05, axisLength * 0.025); // length, headlength, headwidth
        axisLine.name = axisName;
        this.mGridObject3D.add(axisLine);
    }

    getAxisLabel(axisName, axisDirection) {
        let axis_label = "";
        if (axisName == "X-Axis") {
            axis_label = axisDirection.x > 0 ? "E" : "W";
        }
        else if (axisName == "Y-Axis") {
            axis_label = axisDirection.y > 0 ? "N" : "S";
        }
        else {
            axis_label = axisDirection.z > 0 ? "U" : "D";
        }
        return axis_label;
    }

    drawAxisLabel(axisName, axisDirection, axisLength, gridOrginPosition, color, gridLength) {
        // Get the label text
        let labelText = this.getAxisLabel(axisName, axisDirection);
        let labelObjectName = axisName + "Label"; // X-AxisLabel, Y-AxisLabel etc.

        if (this.font == null) {
            console.error("Font for grid labels is not loaded.")
        }
        else {
            let textGeo = null;

            // Remove the existing Label.
            let axisLabelsParent = this.gridObject3D.getObjectByName(labelObjectName);
            if (axisLabelsParent) {
                CommonUtilities.clearThree(axisLabelsParent);
                this.mGridObject3D.remove(axisLabelsParent);
                axisLabelsParent = null;
            }

            textGeo = new THREE.TextGeometry(labelText, {
                font: this.font,
                size: axisLength * 0.04,
                height: 0.05,
                curveSegments: 12
            });

            if (textGeo == null) {
                console.error("It seems that font not loaded");
                return;
            }

            axisLabelsParent = new THREE.Object3D();
            axisLabelsParent.name = labelObjectName;
            this.gridObject3D.add(axisLabelsParent);

            var textMaterial = new THREE.MeshLambertMaterial({ color: color, wireframe: false })
            const labelMesh = new THREE.Mesh(textGeo, textMaterial);

            labelMesh.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
            let textPosition = gridOrginPosition.clone();
            textPosition.addScaledVector(axisDirection, (axisLength * 1.02)); // A bit ahead of the arrow.
            labelMesh.position.set(textPosition.x, textPosition.y, textPosition.z);
            axisLabelsParent.add(labelMesh);

            if (this.mUserOptions.showDivisions == false) {
                return;
            }

            // Create the divisions labels. 
            this.addDivisionsLabels(gridOrginPosition, axisName, axisDirection, color, gridLength, axisLength, axisLabelsParent);
        }
    }

    addDivisionsLabels(gridOrginPosition, axisName, axisDirection, color, gridLength, axisLength, axisLabelsParent) {
        const gridOriginInWorld = gridOrginPosition.clone();
        this.mGridObject3D.localToWorld(gridOriginInWorld);
        let startValue = 0;
        let directionFactor = 1;
        if (axisName == "X-Axis") {
            startValue = gridOriginInWorld.x;
            directionFactor = axisDirection.x;
        }
        else if (axisName == "Y-Axis") {
            startValue = gridOriginInWorld.y;
            directionFactor = axisDirection.y;
        }
        else {
            startValue = gridOriginInWorld.z;
            directionFactor = axisDirection.z;
        }
        const divLabelMaterial = new THREE.MeshLambertMaterial({ color: color, wireframe: true });
        const deltaInrement = gridLength / this.divisions;

        for (let index = 1; index <= this.divisions; index++) {

            let divValue = startValue + (deltaInrement * index * directionFactor);
            divValue = CommonUtilities.truncateToDecimal(divValue, 2);

            const divLabelGeo = new THREE.TextGeometry(divValue.toString(), {
                font: this.font,
                size: axisLength * 0.02,
                height: 0.005,
            });

            const divLabelMesh = new THREE.Mesh(divLabelGeo, divLabelMaterial);

            divLabelMesh.rotation.set(this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z);
            const divLabelTextPosition = gridOrginPosition.clone();
            divLabelTextPosition.addScaledVector(axisDirection, deltaInrement * index);
            divLabelMesh.position.set(divLabelTextPosition.x, divLabelTextPosition.y, divLabelTextPosition.z);
            divLabelMesh.name = divValue;
            axisLabelsParent.add(divLabelMesh);
        }
    }

    // Smooth grid swapping, fun. Totally optional.
    swapThisGridSmoothly(gridPlaneObj) {
        if (gridPlaneObj.userData.mMoveGridInterval) {
            //console.log("returning, previous grid swap in progress");
            return true;
        }
        if (gridPlaneObj.userData.plane) {
            // This is a grid.
            var steps = 10;
            var count = 0;
            var moveDelta = gridPlaneObj.userData.size / steps;
            var direction = gridPlaneObj.userData.direction.clone();
            gridPlaneObj.userData.mMoveGridInterval = setInterval(function () {
                if (gridPlaneObj.userData.mMoveGridInterval && count < steps)
                    gridPlaneObj.translateOnAxis(direction, moveDelta);
                else {
                    clearInterval(gridPlaneObj.userData.mMoveGridInterval);
                    gridPlaneObj.userData.mMoveGridInterval = null;
                    //.log("cleared Interval");
                }
                count++;
            }, 10);
        }
        return false;
    }

    loadFont() {
        return new Promise(resolve => {
            var loader = new THREE.FontLoader();
            loader.load('./helvetiker_regular.typeface.json', function (font) {
                resolve(font);
            });
        });
    }
}