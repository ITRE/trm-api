const mongoose = require('mongoose')
const config = require('../config/database')
const File = mongoose.model('File')

exports.get_version = function(req, res, next) {
  File.find({}).sort({ version: -1 }).limit(1)
    .exec(function(err, file) {
      if (err || !file.length) {
	      return next({name: 'FindError'})
      } else {
        console.log('Version is', file[0].version)
        req.body.files = file[0]
      }
      return next()
  })
}

exports.new_version = function(req, res, next) {
	if (req.body === null || !req.body) {
    return next({name:'Missing'})
  } else {
    File.create(req.body, function (err, file) {
      if (err) {
        return next(err)
      } else {
        console.log('New Version Added')
        req.body.files = file
      }
      return next()
    })
	}
}

exports.get_specific_version = function(req, res, next) {
  File.findOne({"version": req.params.id})
	.exec(function(err, file) {
		if (err) {
      return next({name:'FindError'})
		} else if (file === null) {
      return next({name:'FindError'})
		} else {
			return res.status(200).send({success: true, data: file})
		}
  })
}

exports.delete_files = function(req, res, next) {
  if (req.params.id === 'all') {
    File.deleteMany({}, function(err, file) {
      if (err) {
  			return next(err)
  		}
      return res.status(200).send({ message: 'All Files Successfully Deleted' })
    })
  } else if(validator.isEmpty(req.params.id) || !validator.isEmail(req.params.id)) {
    return next({name:'Missing'})
  } else {
    File.deleteOne({
      "version": req.params.id
    }, function(err, file) {
      if (err) {
  			return next(err)
  		}
      return res.status(200).send({ message: 'File successfully deleted' })
    })
  }
}
