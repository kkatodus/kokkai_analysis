class Logger:
	def __init__(self, path=None, verbose=True):
		self.verbose = verbose
		self.path = path
		if path is not None:
			self.log = open(path, 'w', encoding='utf-8')
		else:
			self.log = None

	def write(self, message):
		self.log.write(message)
	
	def close(self):
		self.log.close()

	def message(self, message):
		if not self.verbose:
			return
		print('--------------------------')
		print(message)
		print('--------------------------')		