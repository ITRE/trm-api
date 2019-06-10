const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Schema = mongoose.Schema

const FileSchema = new Schema({
  name: String,
  version: {
    type: String,
    unique: true
  },
  fileID: String,
  created: {
    type: Date,
    default: Date.now
  }
})


module.exports = mongoose.model('File', FileSchema)
