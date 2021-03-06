import {randomizeRotation, resumePlaying, setupMysteriousObjectBuffer, stopPlaying, updateUniformsf} from "./main";

var gui = $("#gui");
var menuButton = $("#menu-open-button");
var main = $("#main");
var backToGameButton = $("#back-to-game-button");
var loadModelButton = $("#load-button");
var quickDemoButton = $("#quick-demo");
var aboutButton = $("#about-button");
var about = $("#about");
var backFromAboutButton = $("#back-from-about-button");
var hiddenUploadButton = $("#input");

//showMainMenu();

function darkenGui(complete){
    if(!complete){
        gui.css("background-color", "rgba(0, 0, 0, 0.3");
    } else {
        gui.css("background-color", "rgba(0, 0, 0, 0.9");
    }
}

function lightenGui(){
    gui.css("background-color", "rgba(0, 0, 0, 0.0");
}

function showMainMenu(){
    darkenGui();
    menuButton.hide();
    main.show();
}

function hideMainMenu(inTransition/*if true, that means we are loading model data. So for now simply hide all buttons, when the model data is ready, lightenGui will then be called to lighten the background*/){
    if(!inTransition)
        lightenGui();
    menuButton.show();
    main.hide();
}

function modelReady(modelStr){
    lightenGui();
    setupMysteriousObjectBuffer(modelStr);
    randomizeRotation();
    updateUniformsf();
    resumePlaying();
}

menuButton.click(function(){
    stopPlaying();
    showMainMenu();
});

backToGameButton.click(function(){
    resumePlaying();
    hideMainMenu();
});

loadModelButton.click(function(){
    hiddenUploadButton.click();
});

hiddenUploadButton.change(function(){
    var file = this.files[0];
    if(file) {
        hideMainMenu(true);
        backToGameButton.show(); //this button is not shown by default, it is only shown when you successfully load a model for at least once
        var r = new FileReader();
        r.onload = function() {
            var contents = r.result;
            modelReady(contents);
        };
        r.readAsText(file);
    }
});

quickDemoButton.click(function(){
    hideMainMenu(true);
    backToGameButton.show();
    $.get("models/levels/1.obj", function(s){
        modelReady(s);
    });
});

aboutButton.click(function(){
    main.hide();
    about.show();
});

backFromAboutButton.click(function(){
    about.hide();
    main.show();
});
