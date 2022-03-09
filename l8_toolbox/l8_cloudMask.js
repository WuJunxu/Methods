
// // 9. Cloud and cloud shadow masking parameters.
// // If cloudScoreTDOM is chosen
// // cloudScoreThresh: If using the cloudScoreTDOMShift method-Threshold for cloud 
// //    masking (lower number masks more clouds.  Between 10 and 30 generally 
// //    works best)
// var cloudScoreThresh = 20;

// // Percentile of cloud score to pull from time series to represent a minimum for 
// // the cloud score over time for a given pixel. Reduces commission errors over 
// // cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// // bit noisy
// var cloudScorePctl = 0; 

// // contractPixels: The radius of the number of pixels to contract (negative 
// //    buffer) clouds and cloud shadows by. Intended to eliminate smaller cloud 
// //    patches that are likely errors
// // (1.5 results in a -1 pixel buffer)(0.5 results in a -0 pixel buffer)
// // (1.5 or 2.5 generally is sufficient)
// var contractPixels = 1.5; 

// // dilatePixels: The radius of the number of pixels to dilate (buffer) clouds 
// //    and cloud shadows by. Intended to include edges of clouds/cloud shadows 
// //    that are often missed
// // (1.5 results in a 1 pixel buffer)(0.5 results in a 0 pixel buffer)
// // (2.5 or 3.5 generally is sufficient)
// var dilatePixels = 2.5;




////////////////////////////////////////////////////////////////////////////////
// Compute a cloud score and adds a band that represents the cloud mask.  
// This expects the input image to have the common band names: 
// ["red", "blue", etc], so it can work across sensors.
exports.landsatCloudScore = function(ls8,cloudScoreThresh,cloudScorePctl,contractPixels,dilatePixels){
    function getCloudScore (img) {
    // Compute several indicators of cloudiness and take the minimum of them.
    var score = ee.Image(1.0);
    // Clouds are reasonably bright in the blue band.
    score = score.min(rescale(img, 'img.blue', [0.1, 0.3]));
   
    // Clouds are reasonably bright in all visible bands.
    score = score.min(rescale(img, 'img.red + img.green + img.blue', [0.2, 0.8]));
     
    // Clouds are reasonably bright in all infrared bands.
    score = score.min(
      rescale(img, 'img.nir + img.swir1 + img.swir2', [0.3, 0.8]));
  
    // Clouds are reasonably cool in temperature.
    score = score.min(rescale(img,'img.temp', [300, 290]));
  
    // However, clouds are not snow.
    var ndsi = img.normalizedDifference(['green', 'swir1']);
    score = score.min(rescale(ndsi, 'img', [0.8, 0.6]));
    
    // var ss = snowScore(img).select(['snowScore']);
    // score = score.min(rescale(ss, 'img', [0.3, 0]));
    
    score = score.multiply(100).byte();
    score = score.clamp(0,100);
    return img.addBands(score.rename(['cloudScore']));
  }
  
  function maskScore(img){
      //var cloudMask = img.select(['cloudScore']).subtract(minCloudScore).lt(cloudScoreThresh)
      //                                          .focal_max(contractPixels).focal_min(dilatePixels).rename('cloudMask');
      var cloudMask = img.select(['cloudScore']).lt(cloudScoreThresh).focal_max(contractPixels).focal_min(dilatePixels).rename('cloudMask');
      return img .updateMask(cloudMask).addBands(cloudMask);
    }
    
  
  ls8 = ls8.map(getCloudScore);
  
   // Find low cloud score pctl for each pixel to avoid comission errors
    var minCloudScore = ls8.select(['cloudScore']).reduce(ee.Reducer.percentile([cloudScorePctl]));
  
    ls8 = ls8.map(maskScore);
  
  
  return ls8
  };
  
  
  exports.QAMaskCloud = function(ls8){
  ////////////////////////////////////////////////////////////////////////////////
  // Functions for applying fmask to SR data with QA band
  var fmaskBitDict = {'cloud' : 32, 'shadow': 8,'snow':16};
  
  function cFmask(img,fmaskClass){
    var m = img.select('pixel_qa').bitwiseAnd(fmaskBitDict[fmaskClass]).neq(0);
    return img.updateMask(m.not());
  }
  function cFmaskCloud(img){
    return cFmask(img,'cloud');
  }
  function cFmaskCloudShadow(img){
    return cFmask(img,'shadow');
  }
  
    
    ls8 = ls8.map(cFmaskCloud).map(cFmaskCloudShadow)
    return ls8
  };
  
  ////////////////////////////////////////////////////////////////////////////////
  // Helper function to apply an expression and linearly rescale the output.
  // Used in the sentinelCloudScore function below.
  function rescale(img, exp, thresholds) {
    return img.expression(exp, {img: img})
      .subtract(thresholds[0]).divide(thresholds[1] - thresholds[0]);
  }
  