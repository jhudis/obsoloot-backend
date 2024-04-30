import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

let HOST = 'GCF'
let MODE = 'CONT'
const HUB_URL = 'https://berrysmart.games'
const GCF_URL = 'https://us-central1-obsoloot.cloudfunctions.net'
const TRIAL_MS = 5000

const code = `
    boolean isPrime(int n) {
        for (int i = 2; i <= Math.sqrt(n); i++)
            if (n % i == 0)
                return false;
        return n > 1;
    }
`

interface TimedConfig extends InternalAxiosRequestConfig {
    start: number
    duration: number
}

axios.interceptors.request.use(config => ({ ...config, start: performance.now() }));
axios.interceptors.response.use(response => ({ ...response, config: { ...response.config, duration: parseFloat((performance.now() - (response.config as TimedConfig).start).toFixed(4)) }}));

function getRandomInt(min: number, max: number) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

function setIntervalImmediate(callback: () => void, delay: number) {
    callback();
    return setInterval(callback, delay);
}

function makeRequest(callback: (value: AxiosResponse) => any) {
    axios.get(`${HOST === 'HUB' ? HUB_URL : GCF_URL}/invoke?name=prime&args=${getRandomInt(10000, 100000)}`).then(callback);
}

function runTrials(throughput: number) {
    const latencies: number[] = [];
    const requestProcess = setIntervalImmediate(() => makeRequest(res => latencies.push((res.config as TimedConfig).duration)), 1000 / throughput);
    setTimeout(() => {
        clearInterval(requestProcess);
        latencies.sort((a, b) => a - b);
        const medianLatency = latencies[Math.floor(latencies.length * 0.5)];
        const tailLatency = latencies[Math.floor(latencies.length * 0.9)];
        console.log(`Throughput: ${throughput} requests/second, Median Latency: ${medianLatency} ms, Tail Latency: ${tailLatency} ms, Responses: ${latencies.length}`);
        runTrials(throughput * 2);
    }, TRIAL_MS);
}

function runContinuous(throughput: number) {
    let numResponses = 0;
    setIntervalImmediate(() => makeRequest(res => { if (++numResponses % 100 == 0) console.log(`Responses: ${numResponses}, Sample Response: ${res.data}`) }), 1000 / throughput);
}

function run() {
    if (MODE === 'TRIAL') {
        runTrials(1);
    } else {
        runContinuous(5);
    }
}

if (HOST === 'HUB') {
    axios.post(`${HUB_URL}/upload?name=prime&method=isPrime`, code, { headers: { 'Content-Type': 'text/plain' } }).then(_res => run());
} else {
    run();
}
