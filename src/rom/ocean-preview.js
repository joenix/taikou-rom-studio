/** Source ocean texture, gently tinted to distinguish visual padding from ROM terrain. */
export function oceanPreviewPixels(pixels){
 const result=new Uint8ClampedArray(pixels.length),tint=[150,198,232];
 for(let i=0;i<pixels.length;i+=4){for(let channel=0;channel<3;channel++)result[i+channel]=pixels[i+channel]*.78+tint[channel]*.22;result[i+3]=pixels[i+3];}
 return result;
}
