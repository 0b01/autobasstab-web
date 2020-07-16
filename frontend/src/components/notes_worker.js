const workercode = () => {
    // importScripts("http://0.0.0.0:8000/static/notes.js");
    importScripts("http://0.0.0.0:8000/static/fingering.js");

    self.onmessage = function(e) {


        // let get_notes = Module.cwrap("get_notes", 'number', ['number', 'number', 'number', 'number']);

        // function transferToHeap(arr) {
        //     const floatArray = toFloatArr(arr);
        //     let heapSpace = Module._malloc(floatArray.length *
        //                         floatArray.BYTES_PER_ELEMENT); // 1
        //     Module.HEAPF32.set(floatArray, heapSpace >> 2); // 2
        //     return heapSpace;
        //     function toFloatArr(arr) {
        //         const res = new Float32Array(arr.length); // 3
        //         for (let i=0; i < arr.length; i++)
        //             res[i] = arr[i];
        //         return res;
        //     }
        // }

        // function gn(freq, lvl) {
        //     let arrayOnHeap; // 4.
        //     try {
        //         let f = transferToHeap(freq);
        //         let l = transferToHeap(lvl);
        //         let o = transferToHeap(new Array(freq.length * 3).fill(0));
        //         console.log(o);
        //         let ret_sz = get_notes(o, lvl.length, l, f);
        //         console.log(ret_sz);
        //         return Module.HEAPF32.subarray((o>>2), (o>>2) + ret_sz);
        //     } finally {
        //     // Module._free(arrayOnHeap); // 5.
        //     }
        // }

        // let track = gn(e.data.freq, e.data.level);
        // let mut_arrangement = new Uint8Array(track.length / 3 * 2).fill(22);
        frets(-12, mut_arrangement, track);

        self.postMessage({arrangement: mut_arrangement, track});

    }
};

let code = workercode.toString();
code = code.substring(code.indexOf("{")+1, code.lastIndexOf("}"));

const blob = new Blob([code], {type: "application/javascript"});
const worker_script = URL.createObjectURL(blob);
export default worker_script;
