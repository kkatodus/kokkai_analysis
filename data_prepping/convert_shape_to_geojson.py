
import geopandas
import os
import json
from shapely.ops import transform
from params.paths import ROOT_DIR

SHAPE_DIR = os.path.join(ROOT_DIR, 'data', 'data_geo', 'senkyoku2022')

def round_coords(geometry, precision=5):
    def _round_coords(x, y, z=None):
        return (round(x, precision), round(y, precision)) if z is None else (round(x, precision), round(y, precision), z)
    
    return transform(lambda x, y, z=None: _round_coords(x, y, z), geometry)

def main():
    shape_file_path = os.path.join(SHAPE_DIR, 'senkyoku2022.shp')
    shpdata = geopandas.read_file(shape_file_path)
    shpdata = shpdata.dissolve(by='kucode', aggfunc='first')
    print(shpdata.columns)
    # shpdata['geometry'] = shpdata['geometry'].apply(lambda g: round_coords(g, precision=6))
    shpdata['geometry'] = shpdata['geometry'].simplify(tolerance=0.001, preserve_topology=True)
    shpdata = shpdata[['geometry', 'kuname', 'ken']]
    shpdata.crs = None
      
    shpdata.to_file(os.path.join(SHAPE_DIR, 'senkyoku.json'), driver='GeoJSON')
    
    with open(os.path.join(SHAPE_DIR, 'senkyoku.json'), 'r', encoding='utf-8') as f:
        geojson = json.load(f)
    with open(os.path.join(SHAPE_DIR, 'senkyoku_minified.json'), 'w', encoding='utf-8') as f:
        json.dump(geojson, f)
if __name__ == '__main__':
    main()