const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Schema = mongoose.Schema

const UserSchema = new Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  joined: {
    type: Date,
    default: Date.now
  },
  organization: String,
  title: String,
  use: String
})


module.exports = mongoose.model('User', UserSchema)
