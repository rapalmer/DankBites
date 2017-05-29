const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
failureRedirect: '/login',
failureFlash: 'Failed Login.',
successRedirect: '/',
successFlash: 'You are logged in!'
});

exports.logout = (req, res) => {
	req.logout();
	req.flash('success', 'You are now logged out.');
	res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
	// Check if user is authenticated
	if(req.isAuthenticated()) {
		next(); // They are logged in!
		return;
	}
	req.flash('error', 'Oops you must be logged in to do that!');
	res.redirect('/login');
};

exports.forgot = async (req, res) => {
	// 1. See if user exists
	const user = await User.findOne({ email: req.body.email });
	if(!user) {
		req.flash('error', 'A password reset has been sent.');
		return res.redirect('/login');
	}
	// 2. Set reset tokens + expiry on their account
	user.resetPassToken = crypto.randomBytes(20).toString('hex');
	user.resetPassExpires = Date.now() + 3600000; // 1 hour from now
	await user.save();
	// 3. Send them an email with the token
	const resetURL = `http://${req.headers.host}/account/reset/${user.resetPassToken}`;
	mail.send({
		user,
		subject: 'Password Reset',
		resetURL,
		filename: 'password-reset'
	});
	req.flash('success', 'A password reset has been sent.');

	// 4. Redirect to login page
	res.redirect('/login');
};

exports.reset = async (req, res) => {
	const user = await User.findOne({
		resetPassToken: req.params.token,
		resetPassExpires: { $gt: Date.now() }
	});
	if(!user) {
		res.flash('error', 'Password reset is invalid or has expired');
		return res.redirect('/login');
	}
	// if there is a user, take them to reset password form
	res.render('reset', { title: 'Reset Password' });
};

exports.confirmPasswords = (req, res, next) => {
	if(req.body.password === req.body['password-confirm']) {
		next(); // Keep on trucking
		return;
	}
	req.flash('error', 'Passwords do not match!');
	res.redirect('back');
};

exports.updatePassword = async (req, res) => {
	const user = await User.findOne({
		resetPassToken: req.params.token,
		resetPassExpires: { $gt: Date.now() }
	});
	if(!user) {
		req.flash('error', 'Password reset is invalid or has expired.');
		return res.redirect('/login');
	}

	const setPass = promisify(user.setPassword, user);
	await setPass(req.body.password);
	user.resetPassToken = undefined;
	user.resetPassExpires = undefined;
	const updatedUser = await user.save();
	await req.login(updatedUser);
	req.flash('success', 'Successfully Reset!');
	res.redirect('/');
};