const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
	storage: multer.memoryStorage(),
	fileFilter(req, file, next) { 	// ES6 alternative to fileFilter function(re..
		const isPhoto = file.mimetype.startsWith('image/');
		if(isPhoto) {
			next(null, true);
		} else {
			next({ message: 'That filetype isn\'t allowed!'}, false);
		}
	}
};

exports.homePage = (req, res) => {
	res.render('index');
};

exports.addStore = (req, res) => {
	res.render('editStore', { title: 'Add Store' });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
	// Check if there is no new file
	if(!req.file) {
		next(); // Skip to next middleware
		return;
	}
	const extension = req.file.mimetype.split('/')[1];
	req.body.photo = `${uuid.v4()}.${extension}`;
	// Time to resize
	const photo = await jimp.read(req.file.buffer);
	await photo.resize(800, jimp.AUTO);
	await photo.write(`./public/uploads/${req.body.photo}`);
	// Once written to drive keep on trucking!
	next();
};

exports.createStore = async (req, res) => {
	req.body.author = req.user._id;
	const store = await (new Store(req.body)).save();
	await store.save();
	req.flash('success', `Successfully Created ${store.name}. Care to leave a review?`);
	res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
	// 1. Query database for list of stores
	const stores = await Store.find();
	res.render('stores', { title: 'Stores', stores });
};

const confirmOwner = (store, user) => {
	if(!store.author.equals(user._id)) {
		throw Error('You must be the store owner to edit.');
	}
};

exports.editStore = async (req, res) => {
	// 1. Find store given the ID
	const store = await Store.findOne({ _id: req.params.id });
	// 2. Confirm they are the owner
	confirmOwner(store, req.user);
	// 3. Render the edit form so edits can be made
	res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
	// set the location data to be Point
	req.body.location.type= 'Point';
	// Find and update store
	const store = await Store.findOneAndUpdate({ _id: req.params.id },
		req.body, { new: true, runValidators: true}
	).exec();
	req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}"> View Store -></a>`);
	res.redirect(`/stores/${store._id}/edit`);
	// 2. Redirect them if worked
};

exports.getStoreBySlug = async (req, res) => {
	const store = await Store.findOne({ slug: req.params.slug }).populate('author');
	if(!store) return next();
	res.render('store', { store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
	const tag = req.params.tag;
	const tagQuery = tag || { $exists: true };
	const tagsPromise = Store.getTagsList();
	const storesPromise = Store.find({ tags: tagQuery });
	const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);


	res.render('tag', { tags, title: 'Tags', tag, stores });
};

exports.searchStores = async (req, res) => {
	const stores = await Store
	// Find all stores that match
	.find({
		$text: {
			$search: req.query.q,
		}
	}, {
		score: { $meta: 'textScore' }
	})
	// Let mongodb sort them using textScore metadata
	.sort({
		score: { $meta: 'textScore' }
	})
	// Limit to only a small number (e.g. 5)
	.limit(5);
	res.json(stores);
};

exports.mapStores = async (req, res) => {
	const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
	const q = {
		location: {
			$near: {
				$geometry: {
					type: 'Point',
					coordinates
				},
				$maxDistance: 10000 // 10km
			}
		}
	};

	const stores = await Store.find(q).select('slug name description location').limit(10);
	res.json(stores);
};