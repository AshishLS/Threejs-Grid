
class CommonUtilities {

	static DrawPoint(point, parent, size, color) {
		var dotGeometry = new THREE.BufferGeometry();
		dotGeometry.setAttribute('position', new THREE.Float32BufferAttribute([point.x, point.y, point.z], 3));
		var dotMaterial = new THREE.PointsMaterial({ size: size ? size : 5, sizeAttenuation: false, color: color ? color : 0xffffff });
		var dot = new THREE.Points(dotGeometry, dotMaterial);
		if (parent)
			parent.add(dot);
		return dot;
	}

	static clearThree(obj) {
		if (!obj) {
			console.log("Nothing to clear");
			return;
		}
		while (obj.children.length > 0) {
			let child = obj.children[0];
			CommonUtilities.clearThree(child);
			obj.remove(child);
			child = null;
		}
		if (obj.geometry)
			obj.geometry.dispose()

		if (obj.material) {
			//in case of map, bumpMap, normalMap, envMap ...
			Object.keys(obj.material).forEach(prop => {
				if (!obj.material[prop])
					return
				if (obj.material[prop] !== null && typeof obj.material[prop].dispose === 'function')
					obj.material[prop].dispose()
			})
			obj.material.dispose()
		}
	}

    static truncateToDecimal(num, fixed) {
        var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
        return num.toFixed(fixed + 1).match(re)[0];
    }
}