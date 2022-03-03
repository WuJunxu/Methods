// https://gis.stackexchange.com/questions/358095/change-systemindex-of-featurecollection-in-gee

// var geometry = ?

var idList = ee.List.sequence(0,geometry.size().subtract(1))
var geomList = geometry.toList(geometry.size())
var geomID = ee.FeatureCollection(
  idList.map(function(idx){
    var feature = ee.Feature(geomList.get(idx))
    var idxStr = ee.Number(idx).format('%d')
    return feature.set('system:index',idxStr, 'ID',ee.Number(idx).int16())
    })
)

print(geomID)
Map.addLayer(geomID)