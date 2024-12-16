class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(0);
        this.isProcessing = false;
        
        this.port.onmessage = (e) => {
            try {
                const newData = e.data;
                if (!(newData instanceof Float32Array)) {
                    console.error('Invalid data format received');
                    return;
                }
                
                // Append new data to buffer
                const newBuffer = new Float32Array(this.buffer.length + newData.length);
                newBuffer.set(this.buffer);
                newBuffer.set(newData, this.buffer.length);
                this.buffer = newBuffer;
            } catch (error) {
                console.error('Error processing audio message:', error);
            }
        };
    }

    process(inputs, outputs, parameters) {
        try {
            if (this.isProcessing) return true;
            this.isProcessing = true;

            const output = outputs[0];
            
            // Process each channel
            for (let channel = 0; channel < output.length; channel++) {
                const channelData = output[channel];
                
                if (this.buffer.length >= channelData.length) {
                    // Copy data from buffer to output
                    channelData.set(this.buffer.slice(0, channelData.length));
                    // Keep remaining data in buffer
                    this.buffer = this.buffer.slice(channelData.length);
                } else if (this.buffer.length > 0) {
                    // Copy remaining buffer data and fill rest with silence
                    channelData.set(this.buffer);
                    channelData.fill(0, this.buffer.length);
                    this.buffer = new Float32Array(0);
                } else {
                    // No data in buffer, output silence
                    channelData.fill(0);
                }
            }

            this.isProcessing = false;
            return true;
        } catch (error) {
            console.error('Error in audio processing:', error);
            this.isProcessing = false;
            return true;
        }
    }
}

registerProcessor('pcm-processor', PCMProcessor);