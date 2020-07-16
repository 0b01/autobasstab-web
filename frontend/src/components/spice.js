const workercode = () => {
    self.onmessage = function(e) {
        importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.2.9/dist/tf.min.js");
        const cent_mapping = tf.add(tf.linspace(0, 7180, 360), tf.tensor(1997.3794084376191))

        const NUM_INPUT_SAMPLES = 1024;
        const MODEL_SAMPLE_RATE = 16000;
        const PT_OFFSET = 25.58
        const PT_SLOPE = 63.07
        const CONF_THRESHOLD = 0.9;
        const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/spice/2/default/1'

        tf.loadGraphModel(MODEL_URL, { fromTFHub: true }).then(model => {
            let resampled = e.data;

            var crepe_result = {freq: [], conf: [], level: []};
            // console.log(resampled);
            var i = 0;

            self.postMessage({crepe_total: resampled.length, crepe_progress: 0});

            while (i + 1024 < resampled.length) {
                tf.tidy(() => {
                    const frame = tf.tensor(resampled.slice(i, i+1024), [1024]);
                    const output = model.execute({"input_audio_samples": frame });
                    const uncertainties = output[0].dataSync();
                    const pitches = output[1].dataSync();
                    const level = tf.sqrt(tf.abs(tf.mean(frame))).dataSync()[0];

                    // // update the UI and the activation plot
                    // var result = (confidence > 0.5) ? predicted_hz.toFixed(3) + ' Hz' : '&nbsp;no voice&nbsp&nbsp;';
                    // var strlen = result.length;
                    // for (var i = 0; i < 11 - strlen; i++) result = "&nbsp;" + result;
                    // document.getElementById('estimated-pitch').innerHTML = result;
                    // updateActivation(activation.dataSync());
                    // console.log(result);
                    crepe_result.freq.push(uncertainties > 0.4 ? pitches : 0);
                    crepe_result.conf.push(uncertainties);
                    crepe_result.level.push(level);
                    if (i % 1600 == 0) { // update every 10 steps
                        self.postMessage({crepe_progress: i});
                        // console.log(i);
                    }
                });
            i += 160;
            }
            self.postMessage({crepe_result, crepe_progress: resampled.length});
        });

    }
}

let code = workercode.toString();
code = code.substring(code.indexOf("{")+1, code.lastIndexOf("}"));

const blob = new Blob([code], {type: "application/javascript"});
const worker_script = URL.createObjectURL(blob);
export default worker_script;
