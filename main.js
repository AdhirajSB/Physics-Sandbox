/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("canvas_container");
const context = canvas.getContext("2d");

const N = 2;
const BODY_SIZE = 32;
const BUFFER_SIZE = N * BODY_SIZE;


function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize); resize();

if (!navigator.gpu){
    throw new Error("WebGPU is not supported on this browser");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error("No appropriate GPU adapter found");
}
const device = await adapter.requestDevice();
device.lost.then(() => {
    throw new Error("WebGPU logical device was lost");
});


async function loadShader(url) {
    const result = await fetch(url)
    if (!result.ok){
        throw new Error(`Failed to open: ${url}`);
    }
    return result.text();
}


const computeCode = await loadShader("./shaders/compute.wgsl");
const computeModule = device.createShaderModule({
    code: computeCode
});


const bindGroupLayout = device.createBindGroupLayout({
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {type: "read-only-storage"}
        },
        {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {type: "storage"}
        }
    ]
});

const layout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout]
});

const computePipeline = device.createComputePipeline({
    layout: layout,
    compute: {
        module: computeModule,
        entryPoint: "main"
    }
});


const inputBuffer = device.createBuffer({
    size: BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});

const outputBuffer = device.createBuffer({
    size: BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC 
});

const stagingBuffer = device.createBuffer({
    size: BUFFER_SIZE,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
});


const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
    {
        binding: 0,
        resource: {buffer: inputBuffer}
    },
    {
        binding: 1,
        resource: {buffer: outputBuffer}
    }]
});

const inputData = new Float32Array(N * 8);
for (let i = 0; i < N; i++){
    const offset = i * 8;

    inputData[offset + 0] = canvas.width * (Math.random()); // Xpos
    inputData[offset + 1] = canvas.height * (Math.random()); // Ypos
    inputData[offset + 2] = 0; // Vx
    inputData[offset + 3] = 0; // Vy
    inputData[offset + 4] = (1 + Math.random()); // Mass

    inputData[offset + 5] = 0; // Padding
    inputData[offset + 6] = 0; // Padding
    inputData[offset + 7] = 0; // Padding
}
device.queue.writeBuffer(inputBuffer, 0, inputData);


async function renderLoop() {
    const commandEncoder = device.createCommandEncoder();


    // --- Compute Pass ---
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(Math.ceil(N / 64));
    computePass.end()

    commandEncoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, BUFFER_SIZE);
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, inputBuffer, 0, BUFFER_SIZE);

    device.queue.submit([commandEncoder.finish()]);
    
    await stagingBuffer.mapAsync(
        GPUMapMode.READ,
        0,
        BUFFER_SIZE
    );
    const copyArrayBuffer = stagingBuffer.getMappedRange(0, BUFFER_SIZE);
    const data = new Float32Array(copyArrayBuffer.slice());
    stagingBuffer.unmap();

    draw(data);
    requestAnimationFrame(renderLoop);
};
renderLoop();

function draw(data) {
    // console.log(data.slice(0, 8));
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = `rgba(255.0, 255.0, 0.0, 1.0)`;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < N; i++){
        const offset = i * 8;

        const xPos = data[offset + 0];
        const yPos = data[offset + 1];
        const radius = 5 * data[offset + 4];

        context.fillStyle = `rgb(0.0, 0.0, 0.0)`;
        context.beginPath();
        context.arc(xPos, yPos, radius, 0, 2 * Math.PI);
        context.fill();
    }
}

