/*
# ################################################################################ #
#       Export Sentinel-1/Sentinel-2 Time-Series of MultiPoints / Single Band      #
# ################################################################################ #
Copied and updated from 2020 Ujaval Gandhi.
// Source: https://spatialthoughts.com/2020/04/13/extracting-time-series-ee/
*/

// Feature Collection Index by Image Id
var reduceToFeature = function(collection, points, bandName){
    return collection.map(function(image){
      return image.select(bandName).reduceRegions({
      collection: points, 
      reducer: ee.Reducer.mean().setOutputs([bandName]), 
      scale: 10})
      .map(function(feature){
        var band = ee.List([feature.get(bandName), -9999])
          .reduce(ee.Reducer.firstNonNull())
        return feature.set({bandName: band, 'imageID': image.id()})
      })
    }).flatten();
  }
  
  // FeatureCollection Index by Feature Id
  var format = function(table, rowId, colId, bandName) {
    var rows = table.distinct(rowId); 
    var joined = ee.Join.saveAll('matches').apply({
      primary: rows, 
      secondary: table, 
      condition: ee.Filter.equals({
        leftField: rowId, 
        rightField: rowId
      })
    });
          
    return joined.map(function(row) {
        var values = ee.List(row.get('matches'))
          .map(function(feature) {
            feature = ee.Feature(feature);
            return [feature.get(colId), feature.get(bandName)];
          });
        return row.select([rowId]).set(ee.Dictionary(values.flatten()));
      });
  };
  
  // Merge Same Image Imageing Time, output time format YYYYMMdd
  var merge = function(table, rowId, sensor) {
    return table.map(function(feature) {
      var id = feature.get(rowId)
      var allKeys = feature.toDictionary().keys().remove(rowId)
      var substrKeys = ee.List(allKeys.map(function(val) {
        if (sensor=='s1') {var id_slice = ee.String(val).slice(17,25)}
        else if (sensor=='s2') {id_slice = ee.String(val).slice(0,8)}
        else {id_slice = ee.String(val).slice(0,8)}
        return id_slice}
        ))
      var uniqueKeys = substrKeys.distinct()
      var pairs = uniqueKeys.map(function(key) {
        var matches = feature.toDictionary().select(allKeys.filter(ee.Filter.stringContains('item', key))).values()
        var val = matches.reduce(ee.Reducer.max())
        return [key, val]
      })
      return feature.select([rowId]).set(ee.Dictionary(pairs.flatten()))
    })
  }
  
  
  exports.exportTS_MultiPoints = function(collection, points, sensor, bandName){
  
    points = points.map(function(feature) {
      return ee.Feature(feature.geometry(), {'id': feature.id()})
    })
    
    var TS = reduceToFeature(collection, points, bandName)
    TS = format(TS, 'id', 'imageID', bandName);
    TS = merge(TS, 'id', sensor);
    print(TS.first(), 'merge TS')
  
    Export.table.toDrive({
        collection: TS,
        description: sensor+'_'+bandName,
        folder: 'earthengine',
        fileNamePrefix: sensor+'_'+bandName,
        fileFormat: 'CSV'
    })
  }
  