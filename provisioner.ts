import axios, { InternalAxiosRequestConfig } from 'axios';

let MODE = 'GCF'
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

function getRandomInt(min: number, max: number) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

interface TimedConfig extends InternalAxiosRequestConfig {
    start: number
    duration: number
}

axios.interceptors.request.use(
    config => ({ ...config, start: performance.now() }),
    error => Promise.reject(error)
);
  
axios.interceptors.response.use(
    response => ({ ...response, config: { ...response.config, duration: parseFloat((performance.now() - (response.config as TimedConfig).start).toFixed(4)) }}),
    error => Promise.reject(error)
);

if (MODE === 'HUB') {
    axios.post(`${HUB_URL}/upload?name=prime&method=isPrime`, code, { headers: { 'Content-Type': 'text/plain' } })
        .then(_res => runTrial(1));
} else {
    runTrial(1);
}

function setIntervalImmediate(callback: () => void, delay: number) {
    callback();
    return setInterval(callback, delay);
}

function runTrial(throughput: number) {
    const latencies: number[] = [];
    const requestProcess = setIntervalImmediate(() =>
        axios.get(`${MODE === 'HUB' ? HUB_URL : GCF_URL}/invoke?name=prime&args=${getRandomInt(10000, 100000)}`)
            .then(res => latencies.push((res.config as TimedConfig).duration)),
        TRIAL_MS / throughput
    );
    setTimeout(() => {
        clearInterval(requestProcess);
        latencies.sort((a, b) => a - b);
        const medianLatency = latencies[Math.floor(latencies.length * 0.5)];
        const tailLatency = latencies[Math.floor(latencies.length * 0.9)];
        console.log(`Throughput: ${throughput} requests/second, Median Latency: ${medianLatency} ms, Tail Latency: ${tailLatency} ms, Responses: ${latencies.length}`);
        runTrial(throughput * 2);
    }, TRIAL_MS);
}
