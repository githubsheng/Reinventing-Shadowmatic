/**
 * Created by wangsheng on 19/12/15.
 */

var levelCtr = (function(){

    function startViewingModel(loadedModelStr){
        guiCtr.lightenGui();
        setupMysteriousObjectBuffer(loadedModelStr);
        randomizeRotation();
        updateUniformsf();
        resumePlaying();
    }

    function modelReady(modelStr){
        startViewingModel(modelStr);
    }

    return {
        modelReady: modelReady
    }

})();