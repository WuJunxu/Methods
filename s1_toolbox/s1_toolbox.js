/*
# ################################################################################ #
#                                    Mosaic By Date                                #
# ################################################################################ #
*/

// Define the mosaic by time function
var addDate = function(image){
  var date = image.date().format('YYYYMMdd');
  return image.set('date', ee.Number.parse(date));
};

var mosaicByTime = function(images) {
 var TIME_FIELD = 'date'; //system:index

 var distinct = images.distinct([TIME_FIELD]);

 var filter = ee.Filter.equals({ leftField: TIME_FIELD, rightField: TIME_FIELD });
 var join = ee.Join.saveAll('matches');
 var results = join.apply(distinct, images, filter);

 // mosaic
 results = results.map(function(i) {
   var mosaic = ee.ImageCollection.fromImages(i.get('matches')).sort('date').max(); //system:index
   
   return mosaic.copyProperties(i)
     .set(TIME_FIELD, i.get(TIME_FIELD))
     .set('system:time_start', ee.Date.parse('YYYYMMdd',i.get(TIME_FIELD)).millis());
 });
 
 return ee.ImageCollection(results);
};


// ################ Example： Mosaic By Date ################
exports.mosaicByDate = function(s1){
 s1 = s1.map(addDate)
 return mosaicByTime(s1)
}



/*
# ################################################################################ #
#                                 Linear dB Conversion                             #
# ################################################################################ #
*/
var linear2dB = function(image){
 var bandNames = image.bandNames().remove('angle');
 var db = ee.Image.constant(10).multiply(image.select(bandNames).log10()).rename(bandNames)
 return image.addBands(db, null, true)
}

exports.linear2dB = function(image){
 var bandNames = image.bandNames().remove('angle');
 var db = ee.Image.constant(10).multiply(image.select(bandNames).log10()).rename(bandNames)
 return image.addBands(db, null, true)
}

var dB2Linear = function(image) {
 var bandNames = image.bandNames().remove('angle');
 var lin = ee.Image.constant(10).pow(image.select(bandNames).divide(10)).rename(bandNames)
 return image.addBands(lin, null, true)
};

exports.dB2Linear = function(image) {
 var bandNames = image.bandNames().remove('angle');
 var lin = ee.Image.constant(10).pow(image.select(bandNames).divide(10)).rename(bandNames)
 return image.addBands(lin, null, true)
};


exports.addCR = function(image){
 var VV = dB2Linear(image.select('VV'))
 var VH = dB2Linear(image.select('VH'))
 var CR = VH.divide(VV).rename('CR');
 image = image.addBands(linear2dB(CR))
 return image
}

exports.addRVI = function(image){
 var VV = dB2Linear(image.select('VV'))
 var VH = dB2Linear(image.select('VH'))
 var RVI = VH.multiply(4).divide(VV.add(VH)).rename('RVI')
 return image.addBands(linear2dB(RVI))
}

exports.addSUM = function(image){
 var VV = dB2Linear(image.select('VV'))
 var VH = dB2Linear(image.select('VH'))
 var SUM = VH.add(VV).rename('SUM');
 image = image.addBands(linear2dB(SUM))
 return image
}

exports.addDIFF = function(image){
 var VV = dB2Linear(image.select('VV'))
 var VH = dB2Linear(image.select('VH'))
 var DIFF = VV.subtract(VH).rename('DIFF');
 image = image.addBands(linear2dB(DIFF))
 return image
}

exports.addNDRI = function(image){
 var VV = dB2Linear(image.select('VV'))
 var VH = dB2Linear(image.select('VH'))
 var NDRI = (VV.subtract(VH)).divide(VV.add(VH)).rename('NDRI');
 image = image.addBands(linear2dB(NDRI))
 return image
}


/*
# ################################################################################ #
#               Border Noise Remove: S1 Collection Before March, 2018              #
# ################################################################################ #
*/

exports.borderNoiseRemove = function(img, minAngle, maxAngle){
 var angle = img.select('angle')
 var angleMask = angle.updateMask(angle.gte(minAngle)).updateMask(angle.lte(maxAngle))
 return img.updateMask(angleMask)
}


/*
# ################################################################################ #
#                      Incident Angle Correction: Sigma0 to Gamma0                 #
# ################################################################################ #
*/

// Function to apply angle correction (for VV)
var toGammaVV = function(image) {
 return image.addBands(image.select('VV').subtract(image.select('angle')
   .multiply(Math.PI/180.0).cos().log10().multiply(10.0)).rename('VV_corr'));
}
// Function to apply angle correction (for VH)
var toGammaVH = function(image) {
 return image.addBands(image.select('VH').subtract(image.select('angle')
   .multiply(Math.PI/180.0).cos().log10().multiply(10.0)).rename('VH_corr'));
}

exports.IncidentAngleCorrection = function(image){
 var GammaVV = toGammaVV(image)
 var GammaVH = toGammaVH(image)
 return image.addBands(GammaVV).addBands(GammaVH).select(['VV_corr','VH_corr','angle'],['VV','VH','angle'])
}


/*
# ################################################################################ #
#                   Gamma0_Terrain: Radiometric Terrain Flattening                 #
# ################################################################################ #
*/
// Implementation by Andreas Vollrath (ESA), inspired by Johannes Reiche (Wageningen)
exports.terrainCorrection = function(image) { 
 var imgGeom = image.geometry()
 var srtm = ee.Image('JAXA/ALOS/AW3D30/V2_2').select('AVE_DSM').clip(imgGeom)
 // var srtm = ee.Image("USGS/SRTMGL1_003").clip(imgGeom)
 var sigma0Pow = ee.Image.constant(10).pow(image.divide(10.0))

 // Article ( numbers relate to chapters) 
 // 2.1.1 Radar geometry 
 var theta_i = image.select('angle')
 var phi_i = ee.Terrain.aspect(theta_i)
   .reduceRegion(ee.Reducer.mean(), theta_i.get('system:footprint'), 1000)
   .get('aspect')

 // 2.1.2 Terrain geometry
 var alpha_s = ee.Terrain.slope(srtm).select('slope')
 var phi_s = ee.Terrain.aspect(srtm).select('aspect')

 // 2.1.3 Model geometry
 // reduce to 3 angle
 var phi_r = ee.Image.constant(phi_i).subtract(phi_s)

 // convert all to radians
 var phi_rRad = phi_r.multiply(Math.PI / 180);
 var alpha_sRad = alpha_s.multiply(Math.PI / 180);
 var theta_iRad = theta_i.multiply(Math.PI / 180);
 var ninetyRad = ee.Image.constant(90).multiply(Math.PI / 180);

 // slope steepness in range (eq. 2)
 var alpha_r = (alpha_sRad.tan().multiply(phi_rRad.cos())).atan();

 // slope steepness in azimuth (eq 3)
 var alpha_az = (alpha_sRad.tan().multiply(phi_rRad.sin())).atan();

 // local incidence angle (eq. 4)
 var theta_lia = (alpha_az.cos().multiply((theta_iRad.subtract(alpha_r)).cos())).acos();
 var theta_liaDeg = theta_lia.multiply(180 / Math.PI);
 // 2.2 
 // Gamma_nought_flat
 var gamma0 = sigma0Pow.divide(theta_iRad.cos())
 var gamma0dB = ee.Image.constant(10).multiply(gamma0.log10());
 var ratio_1 = gamma0dB.select('VV').subtract(gamma0dB.select('VH'));

 // Volumetric Model
 var nominator = (ninetyRad.subtract(theta_iRad).add(alpha_r)).tan();
 var denominator = (ninetyRad.subtract(theta_iRad)).tan();
 var volModel = (nominator.divide(denominator)).abs();

 // apply model
 var gamma0_Volume = gamma0.divide(volModel);
 var gamma0_VolumeDB = ee.Image.constant(10).multiply(gamma0_Volume.log10());

 // we add a layover/shadow maskto the original implmentation
 // layover, where slope > radar viewing angle 
 var alpha_rDeg = alpha_r.multiply(180 / Math.PI);
 var layover = alpha_rDeg.lt(theta_i);

 // shadow where LIA > 90
 var shadow = theta_liaDeg.lt(85);

 // calculate the ratio for RGB vis
 var ratio = gamma0_VolumeDB.select('VV').subtract(gamma0_VolumeDB.select('VH'));

 var output = gamma0_VolumeDB.addBands(ratio).addBands(alpha_r).addBands(phi_s).addBands(theta_iRad)
   .addBands(layover).addBands(shadow).addBands(gamma0dB).addBands(ratio_1);

 return image.addBands(
   output.select(['VV', 'VH', 'slope_1', 'slope_2'], ['VV', 'VH', 'layover', 'shadow']),
   null,
   true
 )
}


/*
# ################################################################################ #
#                             Decibel--Natural Convert                             #
# ################################################################################ #
*/

var toNatural = function (img) {
 return ee.Image(10.0).pow(img.select(0).divide(10.0));
}
var toDB = function (img) {
 return ee.Image(img).log10().multiply(10.0);
}


/*
# ################################################################################ #
#                                    RefinedLee                                    #
# ################################################################################ #
*/

var bandRefinedLee = function (img, band) {
 // img must be in natural units, i.e. not in dB!
 // Set up 3x3 kernels 
 var weights3 = ee.List.repeat(ee.List.repeat(1,3),3);
 var kernel3 = ee.Kernel.fixed(3,3, weights3, 1, 1, false);

 var mean3 = img.reduceNeighborhood(ee.Reducer.mean(), kernel3);
 var variance3 = img.reduceNeighborhood(ee.Reducer.variance(), kernel3);

 // Use a sample of the 3x3 windows inside a 7x7 windows to determine gradients and directions
 var sample_weights = ee.List([[0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0], [0,1,0,1,0,1,0], [0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0]]);

 var sample_kernel = ee.Kernel.fixed(7,7, sample_weights, 3,3, false);

 // Calculate mean and variance for the sampled windows and store as 9 bands
 var sample_mean = mean3.neighborhoodToBands(sample_kernel); 
 var sample_var = variance3.neighborhoodToBands(sample_kernel);

 // Determine the 4 gradients for the sampled windows
 var gradients = sample_mean.select(1).subtract(sample_mean.select(7)).abs();
 gradients = gradients.addBands(sample_mean.select(6).subtract(sample_mean.select(2)).abs());
 gradients = gradients.addBands(sample_mean.select(3).subtract(sample_mean.select(5)).abs());
 gradients = gradients.addBands(sample_mean.select(0).subtract(sample_mean.select(8)).abs());

 // And find the maximum gradient amongst gradient bands
 var max_gradient = gradients.reduce(ee.Reducer.max());

 // Create a mask for band pixels that are the maximum gradient
 var gradmask = gradients.eq(max_gradient);

 // duplicate gradmask bands: each gradient represents 2 directions
 gradmask = gradmask.addBands(gradmask);

 // Determine the 8 directions
 var directions = sample_mean.select(1).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(7))).multiply(1);
 directions = directions.addBands(sample_mean.select(6).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(2))).multiply(2));
 directions = directions.addBands(sample_mean.select(3).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(5))).multiply(3));
 directions = directions.addBands(sample_mean.select(0).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(8))).multiply(4));
 // The next 4 are the not() of the previous 4
 directions = directions.addBands(directions.select(0).not().multiply(5));
 directions = directions.addBands(directions.select(1).not().multiply(6));
 directions = directions.addBands(directions.select(2).not().multiply(7));
 directions = directions.addBands(directions.select(3).not().multiply(8));

 // Mask all values that are not 1-8
 directions = directions.updateMask(gradmask);

 // "collapse" the stack into a singe band image (due to masking, each pixel has just one value (1-8) in it's directional band, and is otherwise masked)
 directions = directions.reduce(ee.Reducer.sum());  

 //var pal = ['ffffff','ff0000','ffff00', '00ff00', '00ffff', '0000ff', 'ff00ff', '000000'];
 //Map.addLayer(directions.reduce(ee.Reducer.sum()), {min:1, max:8, palette: pal}, 'Directions', false);

 var sample_stats = sample_var.divide(sample_mean.multiply(sample_mean));

 // Calculate localNoiseVariance
 var sigmaV = sample_stats.toArray().arraySort().arraySlice(0,0,5).arrayReduce(ee.Reducer.mean(), [0]);

 // Set up the 7*7 kernels for directional statistics
 var rect_weights = ee.List.repeat(ee.List.repeat(0,7),3).cat(ee.List.repeat(ee.List.repeat(1,7),4));

 var diag_weights = ee.List([[1,0,0,0,0,0,0], [1,1,0,0,0,0,0], [1,1,1,0,0,0,0], 
   [1,1,1,1,0,0,0], [1,1,1,1,1,0,0], [1,1,1,1,1,1,0], [1,1,1,1,1,1,1]]);

 var rect_kernel = ee.Kernel.fixed(7,7, rect_weights, 3, 3, false);
 var diag_kernel = ee.Kernel.fixed(7,7, diag_weights, 3, 3, false);

 // Create stacks for mean and variance using the original kernels. Mask with relevant direction.
 var dir_mean = img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel).updateMask(directions.eq(1));
 var dir_var = img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel).updateMask(directions.eq(1));

 dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel).updateMask(directions.eq(2)));
 dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel).updateMask(directions.eq(2)));

 // and add the bands for rotated kernels
 for (var i=1; i<4; i++) {
   dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
   dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
   dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
   dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
 }

 // "collapse" the stack into a single band image (due to masking, each pixel has just one value in it's directional band, and is otherwise masked)
 dir_mean = dir_mean.reduce(ee.Reducer.sum());
 dir_var = dir_var.reduce(ee.Reducer.sum());

 // A finally generate the filtered value
 var varX = dir_var.subtract(dir_mean.multiply(dir_mean).multiply(sigmaV)).divide(sigmaV.add(1.0));

 var b = varX.divide(dir_var);

 var result = dir_mean.add(b.multiply(img.subtract(dir_mean)));
 return(result.arrayFlatten([[band+'_Lee']]));
}

exports.RefinedLee = function(image){
 var VV_RL = toDB(bandRefinedLee(toNatural(image.select('VV')),'VV'))
 var VH_RL = toDB(bandRefinedLee(toNatural(image.select('VH')),'VH'))
 return image.addBands(VV_RL).addBands(VH_RL).select(['VV_Lee','VH_Lee','angle'],['VV','VH','angle'])
}


/*
# ################################################################################ #
#                                   Perona-Malik                                   #
# ################################################################################ #
*/

/**
* Perona-Malik (anisotropic diffusion) convolution
* 
* by Gennadii Donchyts see https://groups.google.com/forum/#!topic/google-earth-engine-developers/a9W0Nlrhoq0
* I(n+1, i, j) = I(n, i, j) + lambda * (cN * dN(I) + cS * dS(I) + cE * dE(I), cW * dW(I))
* 
* I: ee.Image single band, natural units
* iter: Number of interations to apply filter
* K: kernal size
* opt_method: choose method 1 (default) or 2, DETAILS
* 
* Returns: single band ee.Image in natural units
* 
* Example: image = PeronaMalik(image, 10, 3.5, 1)
*/

// Source: https://mygeoblog.com/2021/01/25/bmax-otsu-for-surface-water-mapping-detection/

exports.PeronaMalik = function(I,iter, K, opt_method) {
 iter = iter || 10;
 K = K || 3;
 var method = opt_method || 1;
 // Define kernels
 var dxW = ee.Kernel.fixed(3, 3,
                          [[ 0,  0,  0],
                           [ 1, -1,  0],
                           [ 0,  0,  0]]);
 var dxE = ee.Kernel.fixed(3, 3,
                          [[ 0,  0,  0],
                           [ 0, -1,  1],
                           [ 0,  0,  0]]);
 var dyN = ee.Kernel.fixed(3, 3,
                          [[ 0,  1,  0],
                           [ 0, -1,  0],
                           [ 0,  0,  0]]);
 var dyS = ee.Kernel.fixed(3, 3,
                          [[ 0,  0,  0],
                           [ 0, -1,  0],
                           [ 0,  1,  0]]);
 var lambda = 0.2;
 var k1 = ee.Image(-1.0/K);
 var k2 = ee.Image(K).multiply(ee.Image(K));
 // Convolve
 for(var i = 0; i < iter; i++) {
   var dI_W = I.convolve(dxW);
   var dI_E = I.convolve(dxE);
   var dI_N = I.convolve(dyN);
   var dI_S = I.convolve(dyS);
 // Combine using choosen method
   switch(method) {
     case 1:
       var cW = dI_W.multiply(dI_W).multiply(k1).exp();
       var cE = dI_E.multiply(dI_E).multiply(k1).exp();
       var cN = dI_N.multiply(dI_N).multiply(k1).exp();
       var cS = dI_S.multiply(dI_S).multiply(k1).exp();
       I = I.add(ee.Image(lambda).multiply(cN.multiply(dI_N).add(cS.multiply(dI_S)).add(cE.multiply(dI_E)).add(cW.multiply(dI_W))));
       break;
     case 2:
       var cW = ee.Image(1.0).divide(ee.Image(1.0).add(dI_W.multiply(dI_W).divide(k2)));
       var cE = ee.Image(1.0).divide(ee.Image(1.0).add(dI_E.multiply(dI_E).divide(k2)));
       var cN = ee.Image(1.0).divide(ee.Image(1.0).add(dI_N.multiply(dI_N).divide(k2)));
       var cS = ee.Image(1.0).divide(ee.Image(1.0).add(dI_S.multiply(dI_S).divide(k2)));
       I = I.add(ee.Image(lambda).multiply(cN.multiply(dI_N).add(cS.multiply(dI_S)).add(cE.multiply(dI_E)).add(cW.multiply(dI_W))));
       break;
   }
 }
 return I;
};


/*
# ################################################################################ #
#                                       Boxcar                                     #
# ################################################################################ #
*/

var boxcar = ee.Kernel.square({radius: 1.5, units: 'pixels', normalize: true});

exports.Boxcar = function(image){
 var VV_BC = image.select('VV').convolve(boxcar).rename('VV_BC')
 var VH_BC = image.select('VH').convolve(boxcar).rename('VH_BC')
 return image.addBands(VV_BC).addBands(VH_BC).select(['VV_BC','VH_BC','angle'],['VV','VH','angle'])
}

//---------------------------------------------------------------------------//
// Boxcar filter
//---------------------------------------------------------------------------//
/** Applies boxcar filter on every image in the collection. */
var boxcar = function(image, KERNEL_SIZE) {
   var bandNames = image.bandNames().remove('angle');
   // Define a boxcar kernel
   var kernel = ee.Kernel.square({radius: (KERNEL_SIZE/2), units: 'pixels', normalize: true});
   // Apply boxcar
   var output = image.select(bandNames).convolve(kernel).rename(bandNames);
 return image.addBands(output, null, true)
};

//---------------------------------------------------------------------------//
// Lee filter 
//---------------------------------------------------------------------------//
/** Lee Filter applied to one image. It is implemented as described in 
J. S. Lee, “Digital image enhancement and noise filtering by use of local statistics,” 
IEEE Pattern Anal. Machine Intell., vol. PAMI-2, pp. 165–168, Mar. 1980.*/

var leefilter = function(image,KERNEL_SIZE) {
       var bandNames = image.bandNames().remove('angle');
       //S1-GRD images are multilooked 5 times in range
       var enl = 5
       // Compute the speckle standard deviation
       var eta = 1.0/Math.sqrt(enl); 
       eta = ee.Image.constant(eta);

       // MMSE estimator
       // Neighbourhood mean and variance
       var oneImg = ee.Image.constant(1);

       var reducers = ee.Reducer.mean().combine({
                     reducer2: ee.Reducer.variance(),
                     sharedInputs: true
                     });
       var stats = image.select(bandNames).reduceNeighborhood({reducer: reducers,kernel: ee.Kernel.square(KERNEL_SIZE/2,'pixels'), optimization: 'window'})
       var meanBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_mean')});
       var varBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_variance')});
       
       var z_bar = stats.select(meanBand);
       var varz = stats.select(varBand);

       // Estimate weight 
       var varx = (varz.subtract(z_bar.pow(2).multiply(eta.pow(2)))).divide(oneImg.add(eta.pow(2)));
       var b = varx.divide(varz);
 
       //if b is negative set it to zero
       var new_b = b.where(b.lt(0), 0)
       var output = oneImg.subtract(new_b).multiply(z_bar.abs()).add(new_b.multiply(image.select(bandNames)));
       output = output.rename(bandNames);
       return image.addBands(output, null, true);
 }   


//---------------------------------------------------------------------------//
// GAMMA MAP filter 
//---------------------------------------------------------------------------//
/** Gamma Maximum a-posterior Filter applied to one image. It is implemented as described in 
Lopes A., Nezry, E., Touzi, R., and Laur, H., 1990.  Maximum A Posteriori Speckle Filtering and First Order texture Models in SAR Images.  
International  Geoscience  and  Remote  Sensing  Symposium (IGARSS).  */

var gammamap =  function(image,KERNEL_SIZE) { 
       var enl = 5;
       var bandNames = image.bandNames().remove('angle');
       //Neighbourhood stats
       var reducers = ee.Reducer.mean().combine({
                     reducer2: ee.Reducer.stdDev(),
                     sharedInputs: true
                     });
       var stats = image.select(bandNames).reduceNeighborhood({reducer: reducers,kernel: ee.Kernel.square(KERNEL_SIZE/2,'pixels'), optimization: 'window'})
       var meanBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_mean')});
       var stdDevBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_stdDev')});
       
       var z = stats.select(meanBand);
       var sigz = stats.select(stdDevBand);
       
       // local observed coefficient of variation
       var ci = sigz.divide(z);
       // noise coefficient of variation (or noise sigma)
       var cu = 1.0/Math.sqrt(enl);
       // threshold for the observed coefficient of variation
       var cmax = Math.sqrt(2.0) * cu
 
       cu = ee.Image.constant(cu);
       cmax = ee.Image.constant(cmax);
       var enlImg = ee.Image.constant(enl);
       var oneImg = ee.Image.constant(1);
       var twoImg = ee.Image.constant(2);
 
       var alpha = oneImg.add(cu.pow(2)).divide(ci.pow(2).subtract(cu.pow(2)));

       //Implements the Gamma MAP filter described in equation 11 in Lopez et al. 1990
       var q = image.select(bandNames).expression("z**2 * (z * alpha - enl - 1)**2 + 4 * alpha * enl * b() * z", {z: z, alpha: alpha,enl: enl})
       var rHat = z.multiply(alpha.subtract(enlImg).subtract(oneImg)).add(q.sqrt()).divide(twoImg.multiply(alpha));
 
       //if ci <= cu then its a homogenous region ->> boxcar filter
       var zHat = (z.updateMask(ci.lte(cu))).rename(bandNames)
       //if cmax > ci > cu then its a textured medium ->> apply Gamma MAP filter
       rHat = (rHat.updateMask(ci.gt(cu)).updateMask(ci.lt(cmax))).rename(bandNames)
       //if ci>=cmax then its strong signal ->> retain
       var x = image.select(bandNames).updateMask(ci.gte(cmax)).rename(bandNames)
 
       // Merge
       var output = ee.ImageCollection([zHat,rHat,x]).sum();
       return image.addBands(output, null, true);
 }   

//---------------------------------------------------------------------------//
// Refined Lee filter 
//---------------------------------------------------------------------------//
/** This filter is modified from the implementation by Guido Lemoine 
* Source: Lemoine et al.; https://code.earthengine.google.com/5d1ed0a0f0417f098fdfd2fa137c3d0c */

var refinedLee = function(image) {

   var bandNames = image.bandNames().remove('angle');
 
   var result = ee.ImageCollection(bandNames.map(function(b){
   var img = image.select([b]);
   
   // img must be linear, i.e. not in dB!
   // Set up 3x3 kernels 
   var weights3 = ee.List.repeat(ee.List.repeat(1,3),3);
   var kernel3 = ee.Kernel.fixed(3,3, weights3, 1, 1, false);
 
   var mean3 = img.reduceNeighborhood(ee.Reducer.mean(), kernel3);
   var variance3 = img.reduceNeighborhood(ee.Reducer.variance(), kernel3);
 
   // Use a sample of the 3x3 windows inside a 7x7 windows to determine gradients and directions
   var sample_weights = ee.List([[0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0], [0,1,0,1,0,1,0], [0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0]]);
 
   var sample_kernel = ee.Kernel.fixed(7,7, sample_weights, 3,3, false);
 
   // Calculate mean and variance for the sampled windows and store as 9 bands
   var sample_mean = mean3.neighborhoodToBands(sample_kernel); 
   var sample_var = variance3.neighborhoodToBands(sample_kernel);
 
   // Determine the 4 gradients for the sampled windows
   var gradients = sample_mean.select(1).subtract(sample_mean.select(7)).abs();
   gradients = gradients.addBands(sample_mean.select(6).subtract(sample_mean.select(2)).abs());
   gradients = gradients.addBands(sample_mean.select(3).subtract(sample_mean.select(5)).abs());
   gradients = gradients.addBands(sample_mean.select(0).subtract(sample_mean.select(8)).abs());
 
   // And find the maximum gradient amongst gradient bands
   var max_gradient = gradients.reduce(ee.Reducer.max());
 
   // Create a mask for band pixels that are the maximum gradient
   var gradmask = gradients.eq(max_gradient);
 
   // duplicate gradmask bands: each gradient represents 2 directions
   gradmask = gradmask.addBands(gradmask);
 
   // Determine the 8 directions
   var directions = sample_mean.select(1).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(7))).multiply(1);
   directions = directions.addBands(sample_mean.select(6).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(2))).multiply(2));
   directions = directions.addBands(sample_mean.select(3).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(5))).multiply(3));
   directions = directions.addBands(sample_mean.select(0).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(8))).multiply(4));
   // The next 4 are the not() of the previous 4
   directions = directions.addBands(directions.select(0).not().multiply(5));
   directions = directions.addBands(directions.select(1).not().multiply(6));
   directions = directions.addBands(directions.select(2).not().multiply(7));
   directions = directions.addBands(directions.select(3).not().multiply(8));
 
   // Mask all values that are not 1-8
   directions = directions.updateMask(gradmask);
 
   // "collapse" the stack into a singe band image (due to masking, each pixel has just one value (1-8) in it's directional band, and is otherwise masked)
   directions = directions.reduce(ee.Reducer.sum());  
 
   //var pal = ['ffffff','ff0000','ffff00', '00ff00', '00ffff', '0000ff', 'ff00ff', '000000'];
   //Map.addLayer(directions.reduce(ee.Reducer.sum()), {min:1, max:8, palette: pal}, 'Directions', false);
 
   var sample_stats = sample_var.divide(sample_mean.multiply(sample_mean));
 
   // Calculate localNoiseVariance
   var sigmaV = sample_stats.toArray().arraySort().arraySlice(0,0,5).arrayReduce(ee.Reducer.mean(), [0]);
 
   // Set up the 7*7 kernels for directional statistics
   var rect_weights = ee.List.repeat(ee.List.repeat(0,7),3).cat(ee.List.repeat(ee.List.repeat(1,7),4));
 
   var diag_weights = ee.List([[1,0,0,0,0,0,0], [1,1,0,0,0,0,0], [1,1,1,0,0,0,0], 
     [1,1,1,1,0,0,0], [1,1,1,1,1,0,0], [1,1,1,1,1,1,0], [1,1,1,1,1,1,1]]);
 
   var rect_kernel = ee.Kernel.fixed(7,7, rect_weights, 3, 3, false);
   var diag_kernel = ee.Kernel.fixed(7,7, diag_weights, 3, 3, false);
 
   // Create stacks for mean and variance using the original kernels. Mask with relevant direction.
   var dir_mean = img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel).updateMask(directions.eq(1));
   var dir_var = img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel).updateMask(directions.eq(1));
 
   dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel).updateMask(directions.eq(2)));
   dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel).updateMask(directions.eq(2)));
 
   // and add the bands for rotated kernels
   for (var i=1; i<4; i++) {
     dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
     dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
     dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
     dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
   }
 
   // "collapse" the stack into a single band image (due to masking, each pixel has just one value in it's directional band, and is otherwise masked)
   dir_mean = dir_mean.reduce(ee.Reducer.sum());
   dir_var = dir_var.reduce(ee.Reducer.sum());
 
   // A finally generate the filtered value
   var varX = dir_var.subtract(dir_mean.multiply(dir_mean).multiply(sigmaV)).divide(sigmaV.add(1.0));
 
   var b = varX.divide(dir_var);
 
   return dir_mean.add(b.multiply(img.subtract(dir_mean)))
     .arrayProject([0])
     // Get a multi-band image bands.
     .arrayFlatten([['sum']])
     .float();
 })).toBands().rename(bandNames).copyProperties(image);
 return image.addBands(result, null, true) 
 } 
//---------------------------------------------------------------------------//
// Improved Lee Sigma filter 
//---------------------------------------------------------------------------//
/** Implements the improved lee sigma filter to one image. 
It is implemented as described in, Lee, J.-S.; Wen, J.-H.; Ainsworth, T.L.; Chen, K.-S.; Chen, A.J. Improved sigma filter for speckle filtering of SAR imagery. 
IEEE Trans. Geosci. Remote Sens. 2009, 47, 202–213. */

var leesigma = function(image,KERNEL_SIZE) {
       //parameters
       var Tk = ee.Image.constant(7); //number of bright pixels in a 3x3 window
       var sigma = 0.9;
       var enl = 4;
       var target_kernel = 3;
       var bandNames = image.bandNames().remove('angle');
 
       //compute the 98 percentile intensity 
       var z98 = image.select(bandNames).reduceRegion({
               reducer: ee.Reducer.percentile([98]),
               geometry: image.geometry(),
               scale:10,
               maxPixels:1e13
           }).toImage();
           
       //select the strong scatterers to retain
       var brightPixel = image.select(bandNames).gte(z98);
       var K = brightPixel.reduceNeighborhood({reducer: ee.Reducer.countDistinctNonNull()
                           ,kernel: ee.Kernel.square((target_kernel/2) ,'pixels')}); 
       var retainPixel = K.gte(Tk);
 
 
       //compute the a-priori mean within a 3x3 local window
       //original noise standard deviation
       var eta = 1.0/Math.sqrt(enl);
       eta = ee.Image.constant(eta);
       //MMSE applied to estimate the a-priori mean
       var reducers = ee.Reducer.mean().combine({
                     reducer2: ee.Reducer.variance(),
                     sharedInputs: true
                     });
       var stats = image.select(bandNames).reduceNeighborhood({reducer: reducers,kernel: ee.Kernel.square(target_kernel/2,'pixels'), optimization: 'window'})
       var meanBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_mean')});
       var varBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_variance')});
       var z_bar = stats.select(meanBand);
       var varz = stats.select(varBand);
       
       var oneImg = ee.Image.constant(1);
       var varx = (varz.subtract(z_bar.abs().pow(2).multiply(eta.pow(2)))).divide(oneImg.add(eta.pow(2)));
       var b = varx.divide(varz);
       var xTilde = oneImg.subtract(b).multiply(z_bar.abs()).add(b.multiply(image.select(bandNames)));
 
       //step 3: compute the sigma range
       // Lookup table (J.S.Lee et al 2009) for range and eta values for intensity (only 4 look is shown here)
       var LUT = ee.Dictionary({0.5: ee.Dictionary({'I1': 0.694,'I2': 1.385,'eta': 0.1921}),
                                0.6: ee.Dictionary({'I1': 0.630,'I2': 1.495,'eta': 0.2348}),
                                0.7: ee.Dictionary({'I1': 0.560,'I2': 1.627,'eta': 0.2825}),
                                0.8: ee.Dictionary({'I1': 0.480,'I2': 1.804,'eta': 0.3354}),
                                0.9: ee.Dictionary({'I1': 0.378,'I2': 2.094,'eta': 0.3991}),
                                0.95: ee.Dictionary({'I1': 0.302,'I2': 2.360,'eta': 0.4391})});
 
       // extract data from lookup
       var sigmaImage = ee.Dictionary(LUT.get(String(sigma))).toImage();
       var I1 = sigmaImage.select('I1');
       var I2 = sigmaImage.select('I2');
       //new speckle sigma
       var nEta = sigmaImage.select('eta');
       //establish the sigma ranges
       I1 = I1.multiply(xTilde);
       I2 = I2.multiply(xTilde);
 
       //step 3: apply the minimum mean square error (MMSE) filter for pixels in the sigma range
       // MMSE estimator
       var mask = image.select(bandNames).gte(I1).or(image.select(bandNames).lte(I2));
       var z = image.select(bandNames).updateMask(mask);

       stats = z.reduceNeighborhood({reducer: reducers,kernel: ee.Kernel.square(KERNEL_SIZE/2,'pixels'), optimization: 'window'})

       z_bar = stats.select(meanBand);
       varz = stats.select(varBand);
       
       varx = (varz.subtract(z_bar.abs().pow(2).multiply(nEta.pow(2)))).divide(oneImg.add(nEta.pow(2)));
       b = varx.divide(varz);
       //if b is negative set it to zero
       var new_b = b.where(b.lt(0), 0);
       var xHat = oneImg.subtract(new_b).multiply(z_bar.abs()).add(new_b.multiply(z));
 
       // remove the applied masks and merge the retained pixels and the filtered pixels
       xHat = image.select(bandNames).updateMask(retainPixel).unmask(xHat);
       var output = ee.Image(xHat).rename(bandNames);
 return image.addBands(output, null, true);
} 

//---------------------------------------------------------------------------//
// 4. Mono-temporal speckle filter 
//---------------------------------------------------------------------------//

/** Mono-temporal speckle Filter   */
exports.MonoTemporal_Filter = function(KERNEL_SIZE, SPECKLE_FILTER) {

 var _filter = function(image) {
   
     if (SPECKLE_FILTER=='BOXCAR'){
     var _filtered = boxcar(image, KERNEL_SIZE);
   } else if (SPECKLE_FILTER=='LEE'){
       _filtered = leefilter(image, KERNEL_SIZE);
   } else if (SPECKLE_FILTER=='GAMMA MAP'){
       _filtered = gammamap(image, KERNEL_SIZE);
   } else if (SPECKLE_FILTER=='REFINED LEE'){
       _filtered = refinedLee(image);
   } else if (SPECKLE_FILTER=='LEE SIGMA'){
       _filtered = leesigma(image, KERNEL_SIZE);}
 return _filtered;
 }
 return _filter;
}

//---------------------------------------------------------------------------//
// 4. Multi-temporal speckle filter
//---------------------------------------------------------------------------//
/* The following Multi-temporal speckle filters are implemented as described in
S. Quegan and J. J. Yu, “Filtering of multichannel SAR images,” 
IEEE Trans Geosci. Remote Sensing, vol. 39, Nov. 2001.*/

/** Multi-temporal boxcar Filter.  */
exports.MultiTemporal_Filter = function(coll,KERNEL_SIZE, SPECKLE_FILTER,NR_OF_IMAGES) {
 
var Quegan = function(image) {
 
   /* this function will filter the collection used for the multi-temporal part
    it takes care of:
       - same image geometry (i.e relative orbit)
       - full overlap of image
       - amount of images taken for filtering 
           -- all before
          -- if not enough, images taken after the image to filter are added */
   var setresample = function (image){
       return image.resample();
   };
   
   var get_filtered_collection = function (image){
     
     
     // filter collection over are and by relative orbit
     var s1_coll = ee.ImageCollection('COPERNICUS/S1_GRD_FLOAT')
               .filterBounds(image.geometry())
               .filter(ee.Filter.eq('instrumentMode', 'IW'))
               .filter(ee.Filter.listContains('transmitterReceiverPolarisation', ee.List(image.get('transmitterReceiverPolarisation')).get(-1)))
               // we need to get this from the image
               //.filter(ee.Filter.and(ee.Filter.eq('transmitterReceiverPolarisation', 'VH'),ee.Filter.eq('transmitterReceiverPolarisation', 'VH')) )
               // we filter for both because of potential change in orbit number around the Equator
               .filter(ee.Filter.or(
                   ee.Filter.eq('relativeOrbitNumber_stop', image.get('relativeOrbitNumber_stop')),
                   ee.Filter.eq('relativeOrbitNumber_stop', image.get('relativeOrbitNumber_start'))
               )).map(setresample)
     
     // a function that takes the image and checks for the overlap
     var check_overlap = function(_image){
         // get all S1 frames from this date intersecting with the image bounds
         var s1 = s1_coll.filterDate(_image.date(), _image.date().advance(1, 'day'))
         // intersect those images with the image to filter
         var intersect = image.geometry().intersection(s1.geometry().dissolve(), 10)
         // check if intersect is sufficient
         var valid_date = ee.Algorithms.If(
           intersect.area(10).divide(image.geometry().area(10)).gt(0.95),
           _image.date().format('YYYY-MM-dd')
         )
         return ee.Feature(null, {'date': valid_date})
     }
     
     
     // this function will pick up the acq dates for fully overlapping acquisitions before the image acquistion
     var dates_before = s1_coll.filterDate('2014-01-01', image.date().advance(1, 'day'))
       .sort('system:time_start', false).limit(5*NR_OF_IMAGES)
       // we check for overlap and sort out partly overlping acquisitions
       .map(check_overlap).distinct('date').aggregate_array('date');
   
     // if the images before are not enough, we add images from after the image acquisition 
     // this will only be the case at the beginning of S1 mission
     var dates = ee.List(
       ee.Algorithms.If(
         dates_before.size().gte(NR_OF_IMAGES),
         dates_before.slice(0, NR_OF_IMAGES),
         s1_coll
           .filterDate(image.date(), '2100-01-01')
           .sort('system:time_start', true).limit(5*NR_OF_IMAGES)
           .map(check_overlap)
           .distinct('date')
           .aggregate_array('date')
           .cat(dates_before).distinct().sort().slice(0, NR_OF_IMAGES)
       )
     )
   
     // now we re-filter the collection to get the right acquisitions for multi-temporal filtering
     return ee.ImageCollection(dates.map(function(date){
       return s1_coll.filterDate(date, ee.Date(date).advance(1,'day')).toList(s1_coll.size())
     }).flatten())
     
   }
         
 
 // we get our dedicated image collection for that image
 var s1 = get_filtered_collection(image)
 
 var bands = image.bandNames().remove('angle');
 s1 = s1.select(bands)
 var meanBands = bands.map(function(bandName){return ee.String(bandName).cat('_mean')});
 var ratioBands = bands.map(function(bandName){return ee.String(bandName).cat('_ratio')});
 var count_img = s1.reduce(ee.Reducer.count());
 //estimate means and ratios
 var inner = function(image){
   if (SPECKLE_FILTER=='BOXCAR'){
     var _filtered = boxcar(image, KERNEL_SIZE).select(bands).rename(meanBands); }
   else if (SPECKLE_FILTER=='LEE'){
     _filtered = leefilter(image, KERNEL_SIZE).select(bands).rename(meanBands);}
   else if (SPECKLE_FILTER=='GAMMA MAP'){
     _filtered = gammamap(image, KERNEL_SIZE).select(bands).rename(meanBands);} 
   else if (SPECKLE_FILTER=='REFINED LEE'){
     _filtered = refinedLee(image).select(bands).rename(meanBands);} 
   else if (SPECKLE_FILTER=='LEE SIGMA'){
     _filtered = leesigma(image, KERNEL_SIZE).select(bands).rename(meanBands);}
  
   var _ratio = image.select(bands).divide(_filtered).rename(ratioBands); 
 return _filtered.addBands(_ratio);
 }
 //perform Quegans filter
 var isum = s1.map(inner).select(ratioBands).reduce(ee.Reducer.sum());
 var filter = inner(image).select(meanBands);
 var divide = filter.divide(count_img);
 var output = divide.multiply(isum).rename(bands);

 return image.addBands(output, null, true)
 }
 return coll.map(Quegan);

};


//---------------------------------------------------------------------------//
// Terrain Flattening
//---------------------------------------------------------------------------//
/* Vollrath, A., Mullissa, A., & Reiche, J. (2020). Angular-Based Radiometric Slope Correction for Sentinel-1 on Google Earth Engine. 
Remote Sensing, 12(11), [1867]. https://doi.org/10.3390/rs12111867
*/ 
exports.slope_correction = function(collection, TERRAIN_FLATTENING_MODEL, 
                                             DEM,
                                             TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER) {

 var ninetyRad = ee.Image.constant(90).multiply(Math.PI/180);

 var _volumetric_model_SCF = function(theta_iRad, alpha_rRad) {
     // Volume model
     var nominator = (ninetyRad.subtract(theta_iRad).add(alpha_rRad)).tan();
     var denominator = (ninetyRad.subtract(theta_iRad)).tan();
     return nominator.divide(denominator);
 }

 var _direct_model_SCF = function(theta_iRad, alpha_rRad, alpha_azRad) {
     // Surface model
     var nominator = (ninetyRad.subtract(theta_iRad)).cos();
     var denominator = alpha_azRad.cos()
       .multiply((ninetyRad.subtract(theta_iRad).add(alpha_rRad)).cos());
     return nominator.divide(denominator);
 }
 
 var _erode = function(image, distance)  {
    // buffer function (thanks Noel)
     var d = (image.not().unmask(1)
         .fastDistanceTransform(30).sqrt()
         .multiply(ee.Image.pixelArea().sqrt()));

     return image.updateMask(d.gt(distance));
   }
 
 var _masking = function(alpha_rRad, theta_iRad, buffer){
       // calculate masks
       // layover, where slope > radar viewing angle
       var layover = alpha_rRad.lt(theta_iRad).rename('layover');
       // shadow
       var shadow = alpha_rRad.gt(ee.Image.constant(-1).multiply(ninetyRad.subtract(theta_iRad))).rename('shadow');
       // combine layover and shadow
       var mask = layover.and(shadow);
       // add buffer to final mask
       if (buffer > 0)
           mask = _erode(mask, buffer);
       return mask.rename('no_data_mask');
  }

 var _correct = function(image) {
       var bandNames = image.bandNames();
       // get the image geometry and projection
       var geom = image.geometry()
       var proj = image.select(1).projection()
       
       var elevation = DEM.resample('bilinear').reproject({crs:proj, scale:10}).clip(geom)
       
       // calculate the look direction
       var heading = (ee.Terrain.aspect(image.select('angle'))
                                    .reduceRegion(ee.Reducer.mean(),image.geometry(),1000))
       
       // in case of null values for heading replace with 0
       heading = ee.Dictionary(heading).combine({aspect: 0}, false).get('aspect')
   
       heading = ee.Algorithms.If(
           ee.Number(heading).gt(180),
           ee.Number(heading).subtract(360),
           ee.Number(heading)
       )
       // the numbering follows the article chapters
       // 2.1.1 Radar geometry 
       var theta_iRad = image.select('angle').multiply(Math.PI/180)
       var phi_iRad = ee.Image.constant(heading).multiply(Math.PI/180)
       
       // 2.1.2 Terrain geometry
       //slope 
       var alpha_sRad = ee.Terrain.slope(elevation).select('slope').multiply(Math.PI / 180)

       // aspect (-180 to 180)
       var aspect = ee.Terrain.aspect(elevation).select('aspect').clip(geom)

       // we need to subtract 360 degree from all values above 180 degree
       var aspect_minus = aspect
         .updateMask(aspect.gt(180))
         .subtract(360)

       // we fill the aspect layer with the subtracted values from aspect_minus
       var phi_sRad = aspect
         .updateMask(aspect.lte(180))
         .unmask() 
         .add(aspect_minus.unmask()) //add the minus values
         .multiply(-1)   // make aspect uphill
         .multiply(Math.PI / 180) // make it rad
       
       // we get the height, for export 
       var height = DEM.reproject(proj).clip(geom)
       
       
       // 2.1.3 Model geometry
       //reduce to 3 angle
       var phi_rRad = phi_iRad.subtract(phi_sRad)

       // slope steepness in range (eq. 2)
       var alpha_rRad = (alpha_sRad.tan().multiply(phi_rRad.cos())).atan()

       // slope steepness in azimuth (eq 3)
       var alpha_azRad = (alpha_sRad.tan().multiply(phi_rRad.sin())).atan()

       // local incidence angle (eq. 4)
       var theta_liaRad = (alpha_azRad.cos().multiply((theta_iRad.subtract(alpha_rRad)).cos())).acos()
       var theta_liaDeg = theta_liaRad.multiply(180/Math.PI)

       // 2.2 
       // Gamma_nought
       var gamma0 = image.divide(theta_iRad.cos())

       if (TERRAIN_FLATTENING_MODEL == 'VOLUME') {
           // Volumetric Model
           var scf = _volumetric_model_SCF(theta_iRad, alpha_rRad)
       }
       
       if (TERRAIN_FLATTENING_MODEL == 'DIRECT') {
           var scf = _direct_model_SCF(theta_iRad, alpha_rRad, alpha_azRad)
       }
       // apply model for Gamm0
       var gamma0_flat = gamma0.multiply(scf)

       // get Layover/Shadow mask
       var mask = _masking(alpha_rRad, theta_iRad, TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER);

       var output = gamma0_flat.mask(mask).rename(bandNames).copyProperties(image);
       
       output = ee.Image(output).addBands(image.select('angle'),null,true);
       
       return output.set('system:time_start', image.get('system:time_start')); 
 }   
 return collection.map(_correct)
}


/*
# ################################################################################ #
#                              Sentinel-1 Process Route                            #
#                            ## Step1: Incident Angle Correction                   #
#                            ## Step2: Speckle Noise Filter                        #
#                            ## Step3: Terrain Correction                          #
# ################################################################################ #
*/



// var s1tbx = require('users/bnuxjw/geetools:s1_toolbox')

// /***********Process Example************/
// var county = Quhua.filter(ee.Filter.eq('NAME','望江县'))

// var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
//   .filterDate('2018-10-01', '2019-06-15')
//   .filterBounds(county)
//   .filter(ee.Filter.eq('platform_number','A'))
//   .filter(ee.Filter.inList('relativeOrbitNumber_start',[40]))
//   .map(s1tbx.IncidentAngleCorrection)
//   .map(s1tbx.dB2Linear)
//   .map(s1tbx.MonoTemporal_Filter(7,'REFINED LEE'))
//   .map(s1tbx.linear2dB)
//   .map(s1tbx.terrainCorrection)
//   .select(['VV','VH'])

