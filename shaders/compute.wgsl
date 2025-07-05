struct Body {
    position: vec2<f32>,
    velocity: vec2<f32>,
    mass: f32,
    _pad1: f32,
    _pad2: f32,
    _pad3: f32
};

@group(0) @binding(0) var<storage, read> bodiesIn: array<Body>;
@group(0) @binding(1) var<storage, read_write> bodiesOut: array<Body>;

const G: f32 = 1000000.0;
const DT: f32 = 0.016;
const EPSILON: f32 = 0.0001;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
    if (i >= arrayLength(&bodiesIn)) {
        return;
    }

    let thiss = bodiesIn[i];
    var acc = vec2<f32>(0.0);

    for (var j: u32 = 0; j < arrayLength(&bodiesIn); j++) {
        if (i == j) { continue; }

        let other = bodiesIn[j];
        let dir = other.position - thiss.position;
        let distSqr = dot(dir, dir);

        if (distSqr < EPSILON) { continue; } // Skip orbits that are too close to avoid instability

        let force = G * other.mass / distSqr;
        acc += normalize(dir) * force;
    }

    var updated = thiss;
    updated.velocity += acc * DT;
    updated.position += updated.velocity * DT;

    bodiesOut[i] = updated;
}
