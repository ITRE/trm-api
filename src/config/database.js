module.exports = {
  'secret': 'super secret passphrase',
  'database': 'mongodb+srv://devin:funiscala@client-wwat7.mongodb.net/test?retryWrites=true',
  'batadase': 'mongodb://devin:funiscala@client-shard-00-00-wwat7.mongodb.net:27017,client-shard-00-01-wwat7.mongodb.net:27017,client-shard-00-02-wwat7.mongodb.net:27017/test?ssl=true&replicaSet=client-shard-0&authSource=admin',
  'port': process.env.PORT || 8000
}
