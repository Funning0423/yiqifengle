#!/usr/bin/env python3
"""Read-only numeric reproduction of 0007 v1.2's slerp/roll rejection.

Run with Python 3, standard library only:
    python3 reproduce_0007_slerp_roll.py

Writes JSON to stdout only. Does not load/run the supplied patch, contact a
service, or modify any project. This is a mathematical reproduction, NOT a
Cocos, Web, WeChat DevTools, or physical-device test.
"""
import json
import math

SOURCE = {
    "drive_file_id": "19aWoRJG5TYmvD4q-5gm0ARbK3snMcRQM",
    "zip_name": "20261009T2227Z-grokbot2-REGION-PAN-CAMERA-0007-v1.2.zip",
    "zip_bytes": 30037,
    "zip_sha256": "3d5440effa7dc994446ea78356d151540da1e26f406f00a8d0808ba430a26cf8",
    "patch_sha256": "0c4b642f23b6765dc9c90a0bfdc4e45e45e10158315633ab4babb62e1ba3fdad",
}

# Supplied FirstsliceRoutes.cameraOutside and RegionCameraData.temporary-6m.
OUTSIDE_POSITION = (-0.58, 1.65, 1.6)
OUTSIDE_TARGET = (-0.2, 1.1, 2.6)
ISLAND_POSITION = (-5.796, 3.323, 9.352)
ISLAND_TARGET = (-2.114, 0.9, 5.281)
ROLL_RIGHT_Y_LIMIT = 1e-3


def norm(v):
    length = math.sqrt(sum(x * x for x in v))
    if length <= 1e-9:
        raise ValueError("zero vector/quaternion")
    return tuple(x / length for x in v)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def look_at_quaternion(position, target):
    """Camera -Z faces target, +X horizontal; quaternion order x,y,z,w."""
    z = norm(tuple(p - t for p, t in zip(position, target)))
    x = norm(cross((0, 1, 0), z))
    y = cross(z, x)
    m00, m01, m02 = x[0], y[0], z[0]
    m10, m11, m12 = x[1], y[1], z[1]
    m20, m21, m22 = x[2], y[2], z[2]
    trace = m00 + m11 + m22
    if trace > 0:
        s = 0.5 / math.sqrt(trace + 1)
        q = ((m21-m12)*s, (m02-m20)*s, (m10-m01)*s, 0.25/s)
    elif m00 > m11 and m00 > m22:
        s = 2 * math.sqrt(1 + m00 - m11 - m22)
        q = (0.25*s, (m01+m10)/s, (m02+m20)/s, (m21-m12)/s)
    elif m11 > m22:
        s = 2 * math.sqrt(1 + m11 - m00 - m22)
        q = ((m01+m10)/s, 0.25*s, (m12+m21)/s, (m02-m20)/s)
    else:
        s = 2 * math.sqrt(1 + m22 - m00 - m11)
        q = ((m02+m20)/s, (m12+m21)/s, 0.25*s, (m10-m01)/s)
    return norm(q)


def slerp(a, b, t):
    """Shortest-path unit quaternion interpolation, as specified in patch."""
    dot = sum(x*y for x, y in zip(a, b))
    if dot < 0:
        dot, b = -dot, tuple(-x for x in b)
    if 1-dot > 1e-6:
        omega = math.acos(min(1, dot))
        sin_omega = math.sin(omega)
        s0 = math.sin((1-t)*omega) / sin_omega
        s1 = math.sin(t*omega) / sin_omega
    else:
        s0, s1 = 1-t, t
    return norm(tuple(s0*x+s1*y for x, y in zip(a, b)))


def camera_right_y(q):
    # Y component of q * (+X) * conjugate(q), identical to rotate(q,[1,0,0])[1].
    x, y, z, w = q
    return 2*(x*y+z*w)


def main():
    a = look_at_quaternion(OUTSIDE_POSITION, OUTSIDE_TARGET)
    b = look_at_quaternion(ISLAND_POSITION, ISLAND_TARGET)
    rows = []
    for t in (0, .01, .1, .25, .5, .75, .9, .99, 1):
        q = slerp(a, b, t)
        right_y = camera_right_y(q)
        rows.append({"progress": t, "quaternion": q,
                     "quaternion_norm": math.sqrt(sum(v*v for v in q)),
                     "camera_right_y": right_y,
                     "applyCameraPose_would_reject": abs(right_y) > ROLL_RIGHT_Y_LIMIT})

    # 121 evenly-spaced normalized samples. This is NOT an assertion about the
    # real clip's duration or engine frame rate. It makes the affected interval
    # and the consequence of rejecting intermediate writes reproducible.
    accepted, rejected, rendered_positions = [], [], []
    last_position = OUTSIDE_POSITION
    for i in range(121):
        t = i/120
        q = slerp(a, b, t)
        requested = tuple(x+(y-x)*t for x, y in zip(OUTSIDE_POSITION, ISLAND_POSITION))
        if abs(camera_right_y(q)) > ROLL_RIGHT_Y_LIMIT:
            rejected.append(t)  # patch returns false without updating position, rotation or FOV
        else:
            last_position = requested
            accepted.append(t)
        rendered_positions.append(last_position)
    jumps = [math.dist(x, y) for x, y in zip(rendered_positions, rendered_positions[1:])]

    midpoint = rows[4]
    assert not rows[0]["applyCameraPose_would_reject"]
    assert not rows[-1]["applyCameraPose_would_reject"]
    assert midpoint["applyCameraPose_would_reject"]
    assert abs(midpoint["camera_right_y"] - (-0.01658571868491418)) < 1e-12
    print(json.dumps({
        "finding": "CONFIRMED: zero-roll endpoints do not imply zero-roll slerp interior",
        "scope": "independent math + reject/retain emulation; no engine or device execution",
        "source": SOURCE,
        "path": {"from": {"position": OUTSIDE_POSITION, "target": OUTSIDE_TARGET},
                 "to": {"position": ISLAND_POSITION, "target": ISLAND_TARGET}},
        "roll_check": "abs(rotate(quaternion, [1,0,0])[1]) > 0.001",
        "fov_note": "FOV 45 or 55 is within range and does not change this roll rejection.",
        "samples": rows,
        "normalized_121_sample_reject_retain_emulation": {
            "accepted_count": len(accepted), "rejected_count": len(rejected),
            "first_rejected_progress": rejected[0], "last_rejected_progress": rejected[-1],
            "largest_successive_position_jump_m": max(jumps),
            "note": "Illustrates current reject-without-write behavior; not an engine measurement."
        },
        "minimum_regression": [
            "Sample the full outside->island and reverse paths through the actual applyCameraPose, not only blendPose endpoints.",
            "Assert accepted writes, finite/unit rotations, intended horizon policy and continuous transforms at every sample.",
            "Handle rejected writes explicitly; the animation caller currently ignores false.",
            "Then verify fixed/motion modes in Creator and WeChat DevTools on the exact integrated baseline."
        ],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
