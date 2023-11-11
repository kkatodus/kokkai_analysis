class Logger:
	def __init__(self, path):
		self.path = path
		self.log = open(path, 'a')

	def write(self, message):
		self.log.write(message)
	
	def close(self):
		self.log.close()