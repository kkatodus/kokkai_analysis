
import geopandas
import os
from params.paths import ROOT_DIR

SHAPE_DIR = os.path.join(ROOT_DIR, 'data', 'data_geo', 'senkyoku2022')

def main():
	shape_file_path = os.path.join(SHAPE_DIR, 'senkyoku2022.shp')
	myshpfile = geopandas.read_file(shape_file_path)
	dissolved = myshpfile.dissolve(by='kucode')
	simplified = dissolved.simplify(tolerance=1000, preserve_topology=True)

	simplified.to_file(os.path.join(SHAPE_DIR, 'senkyoku.json'), driver='GeoJSON')

if __name__ == '__main__':
	main()