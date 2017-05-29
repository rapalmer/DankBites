function autocomplete(input, latInput, lngInput) {
	if(!input) return; // Skip from running without input
	const dropdown = new google.maps.places.Autocomplete(input);

	dropdown.addListener('place_changed', () => {
		const place = dropdown.getPlace();
		latInput.value = place.geometry.location.lat();
		lngInput.value = place.geometry.location.lng();
	});
	// if enter is hit on address field, do not submit form
	input.on('keydown', (e) => {
		if(e.keyCode === 13) e.preventDefault();
	});
}

export default autocomplete;