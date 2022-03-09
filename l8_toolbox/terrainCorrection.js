var scale = 300;
var toaOrSR = 'SR';

// get terrain layers
var dem = ee.Image("USGS/SRTMGL1_003")
var degree2radian = 0.01745;

exports.terrainCorrection = function(collection) {

  collection = collection.map(illuminationCondition);
  collection = collection.map(illuminationCorrection);


  return(collection);

  ////////////////////////////////////////////////////////////////////////////////
  // Function to calculate illumination condition (IC). Function by Patrick Burns 
  // (pb463@nau.edu) and Matt Macander 
  // (mmacander@abrinc.com)
  function illuminationCondition(img){

  // Extract image metadata about solar position
  var SZ_rad = ee.Image.constant(ee.Number(img.get('SOLAR_ZENITH_ANGLE'))).multiply(3.14159265359).divide(180).clip(img.geometry().buffer(10000)); 
  var SA_rad = ee.Image.constant(ee.Number(img.get('SOLAR_AZIMUTH_ANGLE')).multiply(3.14159265359).divide(180)).clip(img.geometry().buffer(10000)); 
  // Creat terrain layers
  var slp = ee.Terrain.slope(dem).clip(img.geometry().buffer(10000));
  var slp_rad = ee.Terrain.slope(dem).multiply(3.14159265359).divide(180).clip(img.geometry().buffer(10000));
  var asp_rad = ee.Terrain.aspect(dem).multiply(3.14159265359).divide(180).clip(img.geometry().buffer(10000));
  
  // Calculate the Illumination Condition (IC)
  // slope part of the illumination condition
  var cosZ = SZ_rad.cos();
  var cosS = slp_rad.cos();
  var slope_illumination = cosS.expression("cosZ * cosS", 
                                          {'cosZ': cosZ,
                                           'cosS': cosS.select('slope')});
  // aspect part of the illumination condition
  var sinZ = SZ_rad.sin(); 
  var sinS = slp_rad.sin();
  var cosAziDiff = (SA_rad.subtract(asp_rad)).cos();
  var aspect_illumination = sinZ.expression("sinZ * sinS * cosAziDiff", 
                                           {'sinZ': sinZ,
                                            'sinS': sinS,
                                            'cosAziDiff': cosAziDiff});
  // full illumination condition (IC)
  var ic = slope_illumination.add(aspect_illumination);

  // Add IC to original image
  var img_plus_ic = ee.Image(img.addBands(ic.rename('IC')).addBands(cosZ.rename('cosZ')).addBands(cosS.rename('cosS')).addBands(slp.rename('slope')));
  return img_plus_ic;
  }
  ////////////////////////////////////////////////////////////////////////////////
  // Function to apply the Sun-Canopy-Sensor + C (SCSc) correction method to each 
  // image. Function by Patrick Burns (pb463@nau.edu) and Matt Macander 
  // (mmacander@abrinc.com)
  function illuminationCorrection(img){
    var props = img.toDictionary();
    var st = img.get('system:time_start');
    
    var img_plus_ic = img;
    var mask1 = img_plus_ic.select('nir').gt(-0.1);
    var mask2 = img_plus_ic.select('slope').gte(5)
                            .and(img_plus_ic.select('IC').gte(0))
                            .and(img_plus_ic.select('nir').gt(-0.1));
    var img_plus_ic_mask2 = ee.Image(img_plus_ic.updateMask(mask2));
    
    // Specify Bands to topographically correct  
    var bandList = ['blue','green','red','nir','swir1','swir2']; 
    var compositeBands = img.bandNames();
    var nonCorrectBands = img.select(compositeBands.removeAll(bandList));
    
    var geom = ee.Geometry(img.get('system:footprint')).bounds().buffer(10000);
    
    function apply_SCSccorr(band){
      var method = 'SCSc';
      var out =  ee.Image(1).addBands(img_plus_ic_mask2.select('IC', band))
                            .reduceRegion({reducer: ee.Reducer.linearRegression(2,1),
                                           geometry: ee.Geometry(img.geometry()),
                                           scale: scale,
                                           bestEffort :true,
                                           maxPixels:1e10});
 
        var fit = out.combine({"coefficients": ee.Array([[1],[1]])}, false);
 
                //Get the coefficients as a nested list,
                // ast it to an array, and get just the selected column
                var out_a = (ee.Array(fit.get('coefficients')).get([0,0]));
                var out_b = (ee.Array(fit.get('coefficients')).get([1,0]));
                var out_c = out_a.divide(out_b);
 
        // Apply the SCSc correction
        var SCSc_output = img_plus_ic_mask2.expression(
        "((image * (cosB * cosZ + cvalue)) / (ic + cvalue))", {
        'image': img_plus_ic_mask2.select(band),
        'ic': img_plus_ic_mask2.select('IC'),
        'cosB': img_plus_ic_mask2.select('cosS'),
        'cosZ': img_plus_ic_mask2.select('cosZ'),
        'cvalue': out_c
        });
 
      return SCSc_output;
 
    }
 
    var img_SCSccorr = ee.Image(bandList.map(apply_SCSccorr)).addBands(img_plus_ic.select('IC'));
    var bandList_IC = ee.List([bandList, 'IC']).flatten();
    img_SCSccorr = img_SCSccorr.unmask(img_plus_ic.select(bandList_IC)).select(bandList);
 
  
    img_SCSccorr = ee.Image(img_SCSccorr.addBands(nonCorrectBands).setMulti(props).set('system:time_start',st))
    return img_SCSccorr.select(['red','green','blue','nir','swir1','swir2',"DOY"])  
  }
  
}  //
