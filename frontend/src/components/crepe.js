const workercode = () => {
    self.onmessage = function(e) {
        importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.4.0/dist/tf.min.js");
        const cent_mapping = tf.add(tf.linspace(0, 7180, 360), tf.tensor(1997.3794084376191))

        var model;
        tf.loadLayersModel('http://0.0.0.0:8000/static/model/model.json').then(model => {
            let resampled = e.data;

            var crepe_result = {freq: [], conf: [], level: []};
            // console.log(resampled);
            var i = 0;

            self.postMessage({crepe_total: resampled.length, crepe_progress: 0});
            const HOP_MS = 20;
            let hop_length = 16000 / 1000 * HOP_MS; // 20 ms

            while (i + 1024 < resampled.length) {
                tf.tidy(() => {
                    var running = true;

                    // run the prediction on the model
                    const frame = tf.tensor(resampled.slice(i, i+1024));
                    const zeromean = tf.sub(frame, tf.mean(frame));
                    const framestd = tf.tensor(tf.norm(zeromean).dataSync()/Math.sqrt(1024));
                    const normalized = tf.div(zeromean, framestd);
                    const input = normalized.reshape([1, 1024]);
                    const activation = model.predict([input]).reshape([360]);

                    // the confidence of voicing activity and the argmax bin
                    const level = tf.sqrt(tf.abs(tf.mean(frame))).dataSync()[0];
                    const confidence = activation.max().dataSync()[0];
                    const center = activation.argMax().dataSync()[0];
                    // document.getElementById('voicing-confidence').innerHTML = confidence.toFixed(3);

                    // slice the local neighborhood around the argmax bin
                    const start = Math.max(0, center - 4);
                    const end = Math.min(360, center + 5);
                    const weights = activation.slice([start], [end - start]);
                    const cents = cent_mapping.slice([start], [end - start]);

                    // take the local weighted average to get the predicted pitch
                    const products = tf.mul(weights, cents);
                    const productSum = products.dataSync().reduce((a, b) => a + b, 0);
                    const weightSum = weights.dataSync().reduce((a, b) => a + b, 0);
                    const predicted_cent = productSum / weightSum;
                    const predicted_hz = 10 * Math.pow(2, predicted_cent / 1200.0);

                    // // update the UI and the activation plot
                    var result = (confidence > 0.5) ? predicted_hz.toFixed(3) + ' Hz' : '&nbsp;no voice&nbsp&nbsp;';
                    // var strlen = result.length;
                    // for (var i = 0; i < 11 - strlen; i++) result = "&nbsp;" + result;
                    // document.getElementById('estimated-pitch').innerHTML = result;
                    // updateActivation(activation.dataSync());
                    // console.log(result);
                    crepe_result.freq.push(confidence > 0.4 ? predicted_hz : 0);
                    crepe_result.conf.push(confidence);
                    crepe_result.level.push(level);
                    if (i % (hop_length * 10) == 0) { // update every 10 steps
                        self.postMessage({crepe_result, crepe_progress: i});
                    }
                });
            i += hop_length;
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
