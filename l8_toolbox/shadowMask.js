// // zScoreThresh: Threshold for cloud shadow masking- lower number masks out 
// //    less. Between -0.8 and -1.2 generally works well
// var zScoreThresh = -1;

// // shadowSumThresh: Sum of IR bands to include as shadows within TDOM and the 
// //    shadow shift method (lower number masks out less)
// var shadowSumThresh = 0.35;

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
// Function for finding dark outliers in time series.
// Original concept written by Carson Stam and adapted by Ian Housman.
// Adds a band that is a mask of pixels that are dark, and dark outliers.
exports.shadowMask = function(collection,studyArea,zScoreThresh,shadowSumThresh,contractPixels,dilatePixels) {

    var shadowSumBands = ['nir','swir1'];
    
    var allCollection = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR").filterBounds(studyArea).select(["B5","B6"],shadowSumBands);
    // Get some pixel-wise stats for the time series
    var irStdDev = allCollection.select(shadowSumBands).reduce(ee.Reducer.stdDev());
    var irMean = allCollection.select(shadowSumBands).mean();
    
    var maskDarkOutliers = function(img){
        var zScore = img.select(shadowSumBands).subtract(irMean).divide(irStdDev);
        var irSum = img.select(shadowSumBands).reduce(ee.Reducer.sum());
        var TDOMMask = zScore.lt(zScoreThresh).reduce(ee.Reducer.sum()).eq(2).and(irSum.lt(shadowSumThresh));
        
        TDOMMask = TDOMMask.focal_min(contractPixels).focal_max(dilatePixels).rename('TDOMMask');
        return img.updateMask(TDOMMask.not()).addBands(TDOMMask);
    };  
    
    // Mask out dark dark outliers
    collection = collection.map(maskDarkOutliers);
  
    return collection;
  };