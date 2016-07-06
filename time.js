/**
 * Created by wangsheng on 23/12/15.
 */

function ElapsedTime(){
    this.startTime = +new Date();
}

ElapsedTime.prototype.getElapsedTime = function(){
    return +new Date() - this.startTime;
};

function Transition(duration, startX, startY, contr1X, contr1Y, contr2X, contr2Y, endX, endY){
    this.duration = duration;
    this.startX = startX;
    this.startY = startY;
    this.contr1X = contr1X;
    this.contr1Y = contr1Y;
    this.contr2X = contr2X;
    this.contr2Y = contr2Y;
    this.endX = endX;
    this.endY = endY;
    this.isRunning = false;
}

Transition.prototype.begin = function(){
    this.isRunning = true;
    this.time = new ElapsedTime();
};

Transition.prototype.getValue = function(getX, getY){
    if(!this.isRunning)
        return -1;

    var et = this.time.getElapsedTime();

    if(et > this.duration){
        this.isRunning = false;
        return {x: this.endX, y: this.endY};
    }

    var t = et / this.duration;

    var x, y;
    if(getX)
        x = this.calBezier(t, this.startX, this.contr1X, this.contr2X, this.endX);

    if(getY)
        y = this.calBezier(t, this.startY, this.contr1Y, this.contr2Y, this.endY);

    return {
        x: x,
        y: y
    };
};

Transition.prototype.calBezier = function calBezier(t, start, c1, c2, end){
    return Math.pow(1-t, 3)*start
        + 3*Math.pow(1-t, 2)*t*c1
        + 3*(1-t)*Math.pow(t, 2)*c2
        + Math.pow(t, 3)*end;
};
