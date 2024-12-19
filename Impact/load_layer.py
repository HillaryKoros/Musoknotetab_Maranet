import os
from django.contrib.gis.utils import LayerMapping
from .models import Crops


crops_mapping = {
    'gid_0': 'GID_0',
    'name_0': 'NAME_0',
    'name_1': 'NAME_1',
    'engtype_1': 'ENGTYPE_1',
    'lack_cc': 'LACK_CC',
    'cod': 'COD',
    'stock': 'stock',
    'flood_tot': 'flood_tot',
    'flood_perc': 'flood_perc',
    'geom': 'MULTIPOLYGON',
}


crops_shp = os.path.abspath(os.path.join(os.path.dirname(__file__), 'data/202412190000_FPimpacts-Crops.shp'))

def run(verbose=True):
    lm = LayerMapping(Crops, crops_shp, crops_mapping, transform=False, encoding='iso-8859-1')
    lm.save(strict=True, verbose=verbose)