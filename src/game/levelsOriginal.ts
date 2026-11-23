import type { LevelDef } from './types.ts';

export const ORIGINAL_LEVELS: LevelDef[] = [
  {
    "id": 1,
    "code": "SECTOR 01",
    "name": "Grand Intake Complex",
    "subtitle": "Cross the vast intake halls and twin overflow galleries. Never linger in the dark water.",
    "difficulty": "Low",
    "timeLimit": 214,
    "parTimes": [
      56,
      88,
      128
    ],
    "fogColor": "#667478",
    "fogDensity": 0.017,
    "ambientTint": "#8da1a6",
    "rooms": [
      {
        "center": [
          0,
          -35.84
        ],
        "size": [
          58.88,
          92.16
        ],
        "ceilingY": 10.5,
        "floorY": -3.4,
        "waterY": 0
      },
      {
        "center": [
          0,
          -122.88
        ],
        "size": [
          58.88,
          84.48
        ],
        "ceilingY": 11,
        "floorY": -3.6,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -29.44,
      "maxX": 29.44,
      "minZ": -166.4,
      "maxZ": 10.24,
      "floorY": -3.6,
      "waterY": 0,
      "ceilingY": 11
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -160
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s1_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s1_p1",
        "kind": "static",
        "position": [
          -6.1,
          0.29,
          -3.53
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_p2",
        "kind": "static",
        "position": [
          -10.271,
          0.28,
          -9.511
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s1_p3",
        "kind": "static",
        "position": [
          -12.184,
          0.29,
          -15.685
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_p4",
        "kind": "static",
        "position": [
          -12.17,
          0.28,
          -21.859
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s1_p5",
        "kind": "static",
        "position": [
          -11.923,
          0.28,
          -27.932
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s1_p6",
        "kind": "static",
        "position": [
          -11.563,
          0.29,
          -34.106
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_p7",
        "kind": "static",
        "position": [
          -9.845,
          0.28,
          -40.279
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s1_p8",
        "kind": "static",
        "position": [
          -4.206,
          0.29,
          -45.109
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_cp1",
        "kind": "static",
        "position": [
          0,
          0.34,
          -51.84
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s1_p9",
        "kind": "static",
        "position": [
          3.204,
          0.28,
          -58.452
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s1_p10",
        "kind": "static",
        "position": [
          9.034,
          0.28,
          -62.484
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s1_p11",
        "kind": "static",
        "position": [
          12.875,
          0.29,
          -68.504
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_p12",
        "kind": "static",
        "position": [
          13.484,
          0.28,
          -74.618
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s1_p13",
        "kind": "static",
        "position": [
          12.453,
          0.29,
          -80.733
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_p14",
        "kind": "static",
        "position": [
          8.674,
          0.28,
          -86.772
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s1_p15",
        "kind": "static",
        "position": [
          3.503,
          0.28,
          -91.867
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s1_p16",
        "kind": "static",
        "position": [
          -0.682,
          0.29,
          -97.782
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_cp2",
        "kind": "static",
        "position": [
          0,
          0.34,
          -104.5
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s1_p17",
        "kind": "static",
        "position": [
          -5.104,
          0.28,
          -110.636
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s1_p18",
        "kind": "static",
        "position": [
          -9.314,
          0.29,
          -116.468
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_p19",
        "kind": "static",
        "position": [
          -11.625,
          0.28,
          -122.517
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s1_p20",
        "kind": "static",
        "position": [
          -12.023,
          0.28,
          -128.465
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s1_p21",
        "kind": "static",
        "position": [
          -11.527,
          0.29,
          -134.513
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_p22",
        "kind": "static",
        "position": [
          -10.412,
          0.28,
          -140.561
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s1_p23",
        "kind": "static",
        "position": [
          -7.799,
          0.29,
          -146.608
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s1_p24",
        "kind": "static",
        "position": [
          -4.559,
          0.28,
          -152.653
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s1_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -160
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          -18.56,
          5.5,
          -51.84
        ],
        "size": [
          21.76,
          11,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          18.56,
          5.5,
          -51.84
        ],
        "size": [
          21.76,
          11,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          0,
          8.6,
          -51.84
        ],
        "size": [
          15.36,
          4.8,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          -17.28,
          5.5,
          -23.04
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          19.84,
          5.5,
          -23.04
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          5.76,
          5.5,
          -76.8
        ],
        "size": [
          3.07,
          11,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          19.2,
          5.5,
          -76.8
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -19.2,
          5.5,
          -99.84
        ],
        "size": [
          20.48,
          11,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          19.2,
          5.5,
          -99.84
        ],
        "size": [
          20.48,
          11,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          0,
          8.8,
          -99.84
        ],
        "size": [
          17.92,
          4.4,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          -17.28,
          5.5,
          -122.88
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          17.28,
          5.5,
          -122.88
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          0,
          0.68,
          -51.84
        ]
      },
      {
        "id": "cp2",
        "position": [
          0,
          0.68,
          -104.5
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -20.48,
            -10.24
          ],
          [
            20.48,
            -10.24
          ],
          [
            20.48,
            -43.52
          ],
          [
            -20.48,
            -43.52
          ]
        ],
        "patrolSpeed": 2.8,
        "chaseSpeed": 6.4,
        "detectionRadius": 0,
        "waterDetectionRadius": 102,
        "scale": 1
      },
      {
        "id": "m2",
        "waypoints": [
          [
            -20.48,
            -64
          ],
          [
            15.36,
            -66.56
          ],
          [
            20.48,
            -138.24
          ],
          [
            -20.48,
            -143.36
          ]
        ],
        "patrolSpeed": 3.1,
        "chaseSpeed": 6.7,
        "detectionRadius": 0,
        "waterDetectionRadius": 109,
        "scale": 1.05
      }
    ],
    "lights": [
      {
        "position": [
          0,
          9.8,
          0
        ],
        "intensity": 1.6
      },
      {
        "position": [
          -12.8,
          9.8,
          -25.6
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          12.8,
          9.8,
          -25.6
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          9.8,
          -51.2
        ],
        "color": "#d8b468",
        "intensity": 1.7
      },
      {
        "position": [
          -10.24,
          9.8,
          -76.8
        ],
        "intensity": 1.5
      },
      {
        "position": [
          10.24,
          9.8,
          -76.8
        ],
        "intensity": 1.3,
        "flickering": true
      },
      {
        "position": [
          0,
          10.2,
          -99.84
        ],
        "color": "#d8b468",
        "intensity": 1.7
      },
      {
        "position": [
          0,
          10.2,
          -125.44
        ],
        "intensity": 1.6
      },
      {
        "position": [
          0,
          10.2,
          -153.6
        ],
        "intensity": 1.6
      }
    ]
  },
  {
    "id": 2,
    "code": "SECTOR 02",
    "name": "Twin Turbine Basins",
    "subtitle": "Ride intersecting ferry barges across massive twin reservoirs and bulkhead locks.",
    "difficulty": "Low",
    "timeLimit": 277,
    "parTimes": [
      67,
      102,
      149
    ],
    "fogColor": "#5c6b70",
    "fogDensity": 0.018,
    "ambientTint": "#859ca3",
    "rooms": [
      {
        "center": [
          0,
          -46.08
        ],
        "size": [
          64,
          112.64
        ],
        "ceilingY": 11,
        "floorY": -3.6,
        "waterY": 0
      },
      {
        "center": [
          0,
          -143.36
        ],
        "size": [
          64,
          89.6
        ],
        "ceilingY": 11.5,
        "floorY": -3.8,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -32,
      "maxX": 32,
      "minZ": -186.88,
      "maxZ": 10.24,
      "floorY": -3.8,
      "waterY": 0,
      "ceilingY": 11.5
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -177.92
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s2_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s2_p1",
        "kind": "static",
        "position": [
          7.192,
          0.29,
          -3.213
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p2",
        "kind": "static",
        "position": [
          12.253,
          0.28,
          -9.047
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s2_p3",
        "kind": "static",
        "position": [
          15.118,
          0.28,
          -15.412
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s2_p4",
        "kind": "static",
        "position": [
          15.752,
          0.29,
          -21.877
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p5",
        "kind": "static",
        "position": [
          15.243,
          0.28,
          -28.341
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s2_p6",
        "kind": "static",
        "position": [
          13.788,
          0.29,
          -34.806
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p7",
        "kind": "static",
        "position": [
          10.808,
          0.28,
          -41.271
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s2_p8",
        "kind": "static",
        "position": [
          5.644,
          0.28,
          -46.848
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s2_cp1",
        "kind": "static",
        "position": [
          0,
          0.34,
          -53.12
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s2_p9",
        "kind": "static",
        "position": [
          -3.531,
          0.29,
          -59.967
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p10",
        "kind": "static",
        "position": [
          -9.445,
          0.28,
          -64.476
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s2_p11",
        "kind": "static",
        "position": [
          -14.114,
          0.29,
          -70.305
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p12",
        "kind": "static",
        "position": [
          -15.29,
          0.28,
          -76.554
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s2_p13",
        "kind": "static",
        "position": [
          -14.703,
          0.28,
          -82.705
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s2_p14",
        "kind": "static",
        "position": [
          -10.951,
          0.29,
          -88.888
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p15",
        "kind": "static",
        "position": [
          -4.697,
          0.28,
          -91.446
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s2_p16",
        "kind": "static",
        "position": [
          1.559,
          0.29,
          -92.98
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p17",
        "kind": "static",
        "position": [
          7.816,
          0.28,
          -94.672
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s2_p18",
        "kind": "static",
        "position": [
          5.934,
          0.28,
          -100.831
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s2_p19",
        "kind": "static",
        "position": [
          -0.084,
          0.29,
          -105.14
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_cp2",
        "kind": "static",
        "position": [
          0,
          0.34,
          -112
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s2_p20",
        "kind": "static",
        "position": [
          5.89,
          0.28,
          -118.04
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s2_p21",
        "kind": "static",
        "position": [
          10.841,
          0.29,
          -123.925
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p22",
        "kind": "static",
        "position": [
          13.706,
          0.28,
          -130.365
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s2_p23",
        "kind": "static",
        "position": [
          14.764,
          0.28,
          -136.699
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s2_p24",
        "kind": "static",
        "position": [
          14.247,
          0.29,
          -143.126
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p25",
        "kind": "static",
        "position": [
          10.547,
          0.28,
          -149.49
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s2_p26",
        "kind": "static",
        "position": [
          4.184,
          0.29,
          -153.124
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p27",
        "kind": "static",
        "position": [
          -2.211,
          0.28,
          -155.837
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s2_p28",
        "kind": "static",
        "position": [
          -8.497,
          0.28,
          -158.79
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s2_p29",
        "kind": "static",
        "position": [
          -11.778,
          0.29,
          -165.161
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s2_p30",
        "kind": "static",
        "position": [
          -7.169,
          0.28,
          -171.165
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s2_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -177.92
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          -20.48,
          5.6,
          -53.12
        ],
        "size": [
          23.04,
          11.2,
          3.07
        ],
        "kind": "concrete"
      },
      {
        "position": [
          20.48,
          5.6,
          -53.12
        ],
        "size": [
          23.04,
          11.2,
          3.07
        ],
        "kind": "concrete"
      },
      {
        "position": [
          0,
          8.8,
          -53.12
        ],
        "size": [
          17.92,
          4.8,
          3.07
        ],
        "kind": "concrete"
      },
      {
        "position": [
          -20.48,
          5.6,
          -106.88
        ],
        "size": [
          23.04,
          11.2,
          3.07
        ],
        "kind": "concrete"
      },
      {
        "position": [
          20.48,
          5.6,
          -106.88
        ],
        "size": [
          23.04,
          11.2,
          3.07
        ],
        "kind": "concrete"
      },
      {
        "position": [
          0,
          8.8,
          -106.88
        ],
        "size": [
          17.92,
          4.8,
          3.07
        ],
        "kind": "concrete"
      },
      {
        "position": [
          -28.16,
          5.5,
          -23.04
        ],
        "size": [
          2.82,
          11.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          5.5,
          -30.72
        ],
        "size": [
          2.82,
          11.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          15.36,
          5.5,
          -79.36
        ],
        "size": [
          3.07,
          11.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -20.48,
          5.5,
          -79.36
        ],
        "size": [
          2.82,
          11.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -19.2,
          5.5,
          -135.68
        ],
        "size": [
          2.82,
          11.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          19.2,
          5.5,
          -135.68
        ],
        "size": [
          2.82,
          11.5,
          2.82
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          0,
          0.68,
          -53.12
        ]
      },
      {
        "id": "cp2",
        "position": [
          0,
          0.68,
          -112
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -23.04,
            -15.36
          ],
          [
            0,
            -12.8
          ],
          [
            25.6,
            -35.84
          ],
          [
            -23.04,
            -40.96
          ]
        ],
        "patrolSpeed": 3.1,
        "chaseSpeed": 6.8,
        "detectionRadius": 0,
        "waterDetectionRadius": 109,
        "scale": 1.05
      },
      {
        "id": "m2",
        "waypoints": [
          [
            20.48,
            -69.12
          ],
          [
            -23.04,
            -71.68
          ],
          [
            -23.04,
            -161.28
          ],
          [
            23.04,
            -161.28
          ]
        ],
        "patrolSpeed": 3.3,
        "chaseSpeed": 7,
        "detectionRadius": 0,
        "waterDetectionRadius": 115,
        "scale": 1.1
      }
    ],
    "lights": [
      {
        "position": [
          0,
          10.2,
          0
        ],
        "intensity": 1.5
      },
      {
        "position": [
          -12.8,
          10.2,
          -25.6
        ],
        "intensity": 1.5
      },
      {
        "position": [
          12.8,
          10.2,
          -25.6
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          6,
          -53.12
        ],
        "color": "#d8b468",
        "intensity": 1.8
      },
      {
        "position": [
          -10.24,
          10.5,
          -79.36
        ],
        "intensity": 1.5
      },
      {
        "position": [
          10.24,
          10.5,
          -79.36
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          6.2,
          -106.88
        ],
        "color": "#d8b468",
        "intensity": 1.8
      },
      {
        "position": [
          0,
          10.8,
          -134.4
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          10.8,
          -168.96
        ],
        "intensity": 1.6
      }
    ]
  },
  {
    "id": 3,
    "code": "SECTOR 03",
    "name": "Hydro-Rotor Sanctuary",
    "subtitle": "Cross massive spinning turbine halls and elevated catwalk rotundas.",
    "difficulty": "Moderate",
    "timeLimit": 275,
    "parTimes": [
      76,
      116,
      168
    ],
    "fogColor": "#566468",
    "fogDensity": 0.019,
    "ambientTint": "#7f9399",
    "rooms": [
      {
        "center": [
          0,
          -53.76
        ],
        "size": [
          66.56,
          122.88
        ],
        "ceilingY": 12,
        "floorY": -3.8,
        "waterY": 0
      },
      {
        "center": [
          0,
          -156.16
        ],
        "size": [
          66.56,
          92.16
        ],
        "ceilingY": 12.5,
        "floorY": -4,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -33.28,
      "maxX": 33.28,
      "minZ": -202.24,
      "maxZ": 10.24,
      "floorY": -4,
      "waterY": 0,
      "ceilingY": 12.5
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -194.56
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s3_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s3_p1",
        "kind": "static",
        "position": [
          -6.866,
          0.29,
          -3.092
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p2",
        "kind": "static",
        "position": [
          -11.465,
          0.28,
          -8.868
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s3_p3",
        "kind": "static",
        "position": [
          -13.811,
          0.28,
          -14.935
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s3_p4",
        "kind": "static",
        "position": [
          -14.585,
          0.29,
          -21.103
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p5",
        "kind": "static",
        "position": [
          -14.398,
          0.28,
          -27.272
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s3_p6",
        "kind": "static",
        "position": [
          -13.178,
          0.29,
          -33.443
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p7",
        "kind": "static",
        "position": [
          -9.798,
          0.28,
          -39.601
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s3_p8",
        "kind": "static",
        "position": [
          -4.991,
          0.28,
          -45.087
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s3_p9",
        "kind": "static",
        "position": [
          -0.16,
          0.29,
          -50.726
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_cp1",
        "kind": "static",
        "position": [
          0,
          0.34,
          -57.5
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s3_p10",
        "kind": "static",
        "position": [
          6.116,
          0.28,
          -62.595
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s3_p11",
        "kind": "static",
        "position": [
          11.509,
          0.29,
          -67.516
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p12",
        "kind": "static",
        "position": [
          15.722,
          0.28,
          -73.325
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s3_p13",
        "kind": "static",
        "position": [
          17.227,
          0.28,
          -79.255
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s3_p14",
        "kind": "static",
        "position": [
          17.468,
          0.29,
          -85.287
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p15",
        "kind": "static",
        "position": [
          16.822,
          0.28,
          -91.32
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s3_p16",
        "kind": "static",
        "position": [
          15.242,
          0.29,
          -97.355
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p17",
        "kind": "static",
        "position": [
          11.498,
          0.28,
          -103.321
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s3_p18",
        "kind": "static",
        "position": [
          6.331,
          0.28,
          -108.307
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s3_p19",
        "kind": "static",
        "position": [
          1.083,
          0.29,
          -113.415
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p20",
        "kind": "static",
        "position": [
          -1.111,
          0.28,
          -119.457
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s3_cp2",
        "kind": "static",
        "position": [
          0,
          0.34,
          -126
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s3_p21",
        "kind": "static",
        "position": [
          -5.42,
          0.29,
          -132.106
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p22",
        "kind": "static",
        "position": [
          -10.137,
          0.28,
          -137.68
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s3_p23",
        "kind": "static",
        "position": [
          -13.982,
          0.28,
          -143.508
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s3_p24",
        "kind": "static",
        "position": [
          -15.777,
          0.29,
          -149.554
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p25",
        "kind": "static",
        "position": [
          -16.002,
          0.28,
          -155.594
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s3_p26",
        "kind": "static",
        "position": [
          -14.79,
          0.29,
          -161.627
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p27",
        "kind": "static",
        "position": [
          -11.465,
          0.28,
          -167.644
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s3_p28",
        "kind": "static",
        "position": [
          -5.716,
          0.28,
          -171.616
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "caution"
      },
      {
        "id": "s3_p29",
        "kind": "static",
        "position": [
          0.291,
          0.29,
          -174.428
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p30",
        "kind": "static",
        "position": [
          6.291,
          0.28,
          -177.219
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s3_p31",
        "kind": "static",
        "position": [
          11.213,
          0.29,
          -182.569
        ],
        "size": [
          3.2,
          0.58,
          3.2
        ],
        "accent": "tile"
      },
      {
        "id": "s3_p32",
        "kind": "static",
        "position": [
          7.2,
          0.28,
          -188.412
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "metal"
      },
      {
        "id": "s3_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -194.56
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          -20.48,
          6,
          -21.12
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          6,
          -21.12
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -21.76,
          6,
          -53.76
        ],
        "size": [
          23.04,
          12.5,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          21.76,
          6,
          -53.76
        ],
        "size": [
          23.04,
          12.5,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          -23.04,
          6,
          -87.04
        ],
        "size": [
          3.07,
          12.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          24.32,
          6,
          -87.04
        ],
        "size": [
          3.07,
          12.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -21.76,
          6,
          -116.48
        ],
        "size": [
          23.04,
          12.5,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          21.76,
          6,
          -116.48
        ],
        "size": [
          23.04,
          12.5,
          2.82
        ],
        "kind": "concrete"
      },
      {
        "position": [
          -19.2,
          6,
          -167.68
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          19.2,
          6,
          -167.68
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          0,
          0.68,
          -57.5
        ]
      },
      {
        "id": "cp2",
        "position": [
          0,
          0.68,
          -126
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -25.6,
            -10.24
          ],
          [
            26.24,
            -20.48
          ],
          [
            28.8,
            -87.04
          ],
          [
            -28.16,
            -87.04
          ]
        ],
        "patrolSpeed": 3.3,
        "chaseSpeed": 7.1,
        "detectionRadius": 0,
        "waterDetectionRadius": 115,
        "scale": 1.1
      },
      {
        "id": "m2",
        "waypoints": [
          [
            -23.04,
            -125.44
          ],
          [
            23.04,
            -133.12
          ],
          [
            23.04,
            -181.76
          ],
          [
            -23.04,
            -181.76
          ]
        ],
        "patrolSpeed": 3.5,
        "chaseSpeed": 7.4,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.15
      }
    ],
    "lights": [
      {
        "position": [
          0,
          11.2,
          -17.92
        ],
        "intensity": 1.6
      },
      {
        "position": [
          0,
          11.2,
          -53.76
        ],
        "intensity": 1.5,
        "flickering": true
      },
      {
        "position": [
          -12.8,
          11.2,
          -87.04
        ],
        "intensity": 1.5
      },
      {
        "position": [
          15.36,
          11.2,
          -87.04
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          11.5,
          -117.76
        ],
        "color": "#d8b468",
        "intensity": 1.7
      },
      {
        "position": [
          0,
          11.5,
          -151.04
        ],
        "intensity": 1.5,
        "flickering": true
      },
      {
        "position": [
          0,
          11.5,
          -181.76
        ],
        "intensity": 1.6
      }
    ]
  },
  {
    "id": 4,
    "code": "SECTOR 04",
    "name": "Fractured Cisterns",
    "subtitle": "Sprint across collapsing tile galleries before the submerged stalkers claim you.",
    "difficulty": "Moderate",
    "timeLimit": 305,
    "parTimes": [
      78,
      120,
      176
    ],
    "fogColor": "#4f5d61",
    "fogDensity": 0.02,
    "ambientTint": "#75898f",
    "rooms": [
      {
        "center": [
          0,
          -57.6
        ],
        "size": [
          61.44,
          130.56
        ],
        "ceilingY": 10.5,
        "floorY": -4,
        "waterY": 0
      },
      {
        "center": [
          0,
          -166.4
        ],
        "size": [
          61.44,
          97.28
        ],
        "ceilingY": 11,
        "floorY": -4.2,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -30.72,
      "maxX": 30.72,
      "minZ": -215.04,
      "maxZ": 10.24,
      "floorY": -4.2,
      "waterY": 0,
      "ceilingY": 11
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -208.64
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s4_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s4_p1",
        "kind": "static",
        "position": [
          5.108,
          0.28,
          -4.001
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p2",
        "kind": "static",
        "position": [
          8.614,
          0.275,
          -10.294
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s4_p3",
        "kind": "static",
        "position": [
          10.679,
          0.28,
          -16.64
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_p4",
        "kind": "static",
        "position": [
          11.883,
          0.275,
          -22.984
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s4_p5",
        "kind": "static",
        "position": [
          11.789,
          0.28,
          -29.327
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p6",
        "kind": "static",
        "position": [
          8.406,
          0.28,
          -35.747
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p7",
        "kind": "static",
        "position": [
          2.165,
          0.275,
          -39.46
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s4_p8",
        "kind": "static",
        "position": [
          -4.172,
          0.28,
          -42.348
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_p9",
        "kind": "static",
        "position": [
          -10.436,
          0.275,
          -45.938
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s4_p10",
        "kind": "static",
        "position": [
          -11.088,
          0.28,
          -52.271
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p11",
        "kind": "static",
        "position": [
          -6.146,
          0.28,
          -58.1
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_cp1",
        "kind": "static",
        "position": [
          0,
          0.34,
          -64
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_p12",
        "kind": "static",
        "position": [
          -5.58,
          0.275,
          -70.351
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s4_p13",
        "kind": "static",
        "position": [
          -10.213,
          0.28,
          -76.324
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_p14",
        "kind": "static",
        "position": [
          -13.206,
          0.275,
          -82.749
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s4_p15",
        "kind": "static",
        "position": [
          -14.441,
          0.28,
          -89.171
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p16",
        "kind": "static",
        "position": [
          -14.716,
          0.28,
          -95.69
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p17",
        "kind": "static",
        "position": [
          -13.691,
          0.275,
          -102.104
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s4_p18",
        "kind": "static",
        "position": [
          -9.921,
          0.28,
          -108.404
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_p19",
        "kind": "static",
        "position": [
          -3.717,
          0.275,
          -112.466
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s4_p20",
        "kind": "static",
        "position": [
          2.663,
          0.28,
          -115.713
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p21",
        "kind": "static",
        "position": [
          9.049,
          0.28,
          -119.565
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p22",
        "kind": "static",
        "position": [
          10.589,
          0.275,
          -125.952
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s4_p23",
        "kind": "static",
        "position": [
          6.055,
          0.28,
          -131.929
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_cp2",
        "kind": "static",
        "position": [
          0,
          0.34,
          -138
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_p24",
        "kind": "static",
        "position": [
          4.476,
          0.275,
          -144.806
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s4_p25",
        "kind": "static",
        "position": [
          8.106,
          0.28,
          -151.073
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p26",
        "kind": "static",
        "position": [
          10.371,
          0.28,
          -157.514
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p27",
        "kind": "static",
        "position": [
          11.616,
          0.275,
          -163.849
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s4_p28",
        "kind": "static",
        "position": [
          11.964,
          0.28,
          -170.178
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_p29",
        "kind": "static",
        "position": [
          10.688,
          0.275,
          -176.498
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s4_p30",
        "kind": "static",
        "position": [
          6.123,
          0.28,
          -182.377
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p31",
        "kind": "static",
        "position": [
          0.025,
          0.28,
          -186.785
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s4_p32",
        "kind": "static",
        "position": [
          -6.056,
          0.275,
          -190.876
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s4_p33",
        "kind": "static",
        "position": [
          -11.105,
          0.28,
          -196.399
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s4_p34",
        "kind": "static",
        "position": [
          -7.732,
          0.275,
          -202.652
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s4_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -208.64
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          -17.92,
          5.5,
          -23.04
        ],
        "size": [
          2.56,
          11,
          2.56
        ],
        "kind": "pillar"
      },
      {
        "position": [
          17.92,
          5.5,
          -23.04
        ],
        "size": [
          2.56,
          11,
          2.56
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -20.48,
          5.5,
          -71.68
        ],
        "size": [
          2.56,
          11,
          2.56
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          5.5,
          -71.68
        ],
        "size": [
          2.56,
          11,
          2.56
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -17.92,
          5.5,
          -117.76
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          17.92,
          5.5,
          -117.76
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -17.92,
          5.5,
          -168.96
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          17.92,
          5.5,
          -168.96
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          0,
          0.68,
          -64
        ]
      },
      {
        "id": "cp2",
        "position": [
          0,
          0.68,
          -138
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -20.48,
            -12.8
          ],
          [
            20.48,
            -12.8
          ],
          [
            20.48,
            -92.16
          ],
          [
            -20.48,
            -92.16
          ]
        ],
        "patrolSpeed": 3.4,
        "chaseSpeed": 7.3,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.15
      },
      {
        "id": "m2",
        "waypoints": [
          [
            20.48,
            -110.08
          ],
          [
            -24.32,
            -117.76
          ],
          [
            -20.48,
            -194.56
          ],
          [
            20.48,
            -194.56
          ]
        ],
        "patrolSpeed": 3.6,
        "chaseSpeed": 7.6,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.2
      }
    ],
    "lights": [
      {
        "position": [
          0,
          9.8,
          -12.8
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          9.8,
          -48.64
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          9.8,
          -84.48
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          10.2,
          -122.88
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          10.2,
          -161.28
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          10.2,
          -199.68
        ],
        "intensity": 1.5
      }
    ]
  },
  {
    "id": 5,
    "code": "SECTOR 05",
    "name": "The Great Colonnade",
    "subtitle": "Ascend multi-story drowned pillar halls while apex stalkers prowl beneath high catwalks.",
    "difficulty": "Moderate",
    "timeLimit": 335,
    "parTimes": [
      88,
      134,
      195
    ],
    "fogColor": "#4c595d",
    "fogDensity": 0.019,
    "ambientTint": "#6e8187",
    "rooms": [
      {
        "center": [
          0,
          -61.44
        ],
        "size": [
          71.68,
          140.8
        ],
        "ceilingY": 13,
        "floorY": -4.2,
        "waterY": 0
      },
      {
        "center": [
          0,
          -179.2
        ],
        "size": [
          71.68,
          110.08
        ],
        "ceilingY": 13.5,
        "floorY": -4.4,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -35.84,
      "maxX": 35.84,
      "minZ": -230.4,
      "maxZ": 10.24,
      "floorY": -4.4,
      "waterY": 0,
      "ceilingY": 13.5
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -222.72
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s5_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s5_p1",
        "kind": "static",
        "position": [
          -5.427,
          0.28,
          -3.815
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p2",
        "kind": "static",
        "position": [
          -9.203,
          0.275,
          -9.894
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_p3",
        "kind": "static",
        "position": [
          -11.682,
          0.28,
          -16.09
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p4",
        "kind": "static",
        "position": [
          -13.493,
          0.275,
          -22.285
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p5",
        "kind": "static",
        "position": [
          -13.962,
          0.28,
          -28.478
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p6",
        "kind": "static",
        "position": [
          -11.497,
          0.275,
          -34.669
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_p7",
        "kind": "static",
        "position": [
          -5.648,
          0.28,
          -39.025
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p8",
        "kind": "static",
        "position": [
          0.521,
          0.275,
          -42.257
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p9",
        "kind": "static",
        "position": [
          6.691,
          0.28,
          -45.456
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p10",
        "kind": "static",
        "position": [
          12.606,
          0.275,
          -49.65
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_p11",
        "kind": "static",
        "position": [
          13.273,
          0.28,
          -55.829
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p12",
        "kind": "static",
        "position": [
          8.74,
          0.275,
          -61.571
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p13",
        "kind": "static",
        "position": [
          3.275,
          0.28,
          -66.509
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_cp1",
        "kind": "static",
        "position": [
          -3,
          0.34,
          -72
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p14",
        "kind": "static",
        "position": [
          -7.748,
          0.275,
          -78.66
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_p15",
        "kind": "static",
        "position": [
          -11.857,
          0.28,
          -84.732
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p16",
        "kind": "static",
        "position": [
          -15.1,
          0.275,
          -91.006
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p17",
        "kind": "static",
        "position": [
          -16.502,
          0.28,
          -97.291
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p18",
        "kind": "static",
        "position": [
          -16.695,
          0.275,
          -103.57
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_p19",
        "kind": "static",
        "position": [
          -15.773,
          0.28,
          -109.841
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p20",
        "kind": "static",
        "position": [
          -13.259,
          0.275,
          -116.102
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p21",
        "kind": "static",
        "position": [
          -8.07,
          0.28,
          -121.45
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p22",
        "kind": "static",
        "position": [
          -1.868,
          0.275,
          -124.852
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_p23",
        "kind": "static",
        "position": [
          4.362,
          0.28,
          -127.735
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p24",
        "kind": "static",
        "position": [
          10.573,
          0.275,
          -130.905
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p25",
        "kind": "static",
        "position": [
          14.022,
          0.28,
          -137.073
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p26",
        "kind": "static",
        "position": [
          9.297,
          0.275,
          -142.734
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_cp2",
        "kind": "static",
        "position": [
          3,
          0.34,
          -148
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p27",
        "kind": "static",
        "position": [
          8.027,
          0.28,
          -154.875
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p28",
        "kind": "static",
        "position": [
          12.154,
          0.275,
          -161.128
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p29",
        "kind": "static",
        "position": [
          14.909,
          0.28,
          -167.592
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p30",
        "kind": "static",
        "position": [
          15.806,
          0.275,
          -174.049
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_p31",
        "kind": "static",
        "position": [
          15.727,
          0.28,
          -180.496
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p32",
        "kind": "static",
        "position": [
          14.431,
          0.275,
          -186.932
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p33",
        "kind": "static",
        "position": [
          10.931,
          0.28,
          -193.304
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p34",
        "kind": "static",
        "position": [
          4.83,
          0.275,
          -197.641
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_p35",
        "kind": "static",
        "position": [
          -1.549,
          0.28,
          -200.878
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s5_p36",
        "kind": "static",
        "position": [
          -7.908,
          0.275,
          -204.198
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s5_p37",
        "kind": "static",
        "position": [
          -12.058,
          0.28,
          -210.34
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s5_p38",
        "kind": "static",
        "position": [
          -7.551,
          0.275,
          -216.313
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s5_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -222.72
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          -17.92,
          6.5,
          -15.36
        ],
        "size": [
          2.82,
          13.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          17.92,
          6.5,
          -15.36
        ],
        "size": [
          2.82,
          13.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          1.28,
          6.5,
          -17.92
        ],
        "size": [
          2.82,
          13.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -20.48,
          6.5,
          -61.44
        ],
        "size": [
          3.07,
          13.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          25.6,
          6.5,
          -61.44
        ],
        "size": [
          3.07,
          13.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -20.48,
          6.5,
          -117.76
        ],
        "size": [
          3.07,
          13.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          6.5,
          -117.76
        ],
        "size": [
          3.07,
          13.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -20.48,
          6.5,
          -176.64
        ],
        "size": [
          3.07,
          13.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          6.5,
          -176.64
        ],
        "size": [
          3.07,
          13.5,
          3.07
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          -3,
          0.68,
          -72
        ]
      },
      {
        "id": "cp2",
        "position": [
          3,
          0.68,
          -148
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            24.32,
            -12.8
          ],
          [
            -23.04,
            -28.16
          ],
          [
            -23.04,
            -81.92
          ],
          [
            26.24,
            -81.92
          ]
        ],
        "patrolSpeed": 3.4,
        "chaseSpeed": 7.4,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.1
      },
      {
        "id": "m2",
        "waypoints": [
          [
            -23.04,
            -99.84
          ],
          [
            23.04,
            -104.96
          ],
          [
            23.04,
            -158.72
          ],
          [
            -23.04,
            -158.72
          ]
        ],
        "patrolSpeed": 3.6,
        "chaseSpeed": 7.6,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.15
      },
      {
        "id": "m3",
        "waypoints": [
          [
            23.04,
            -168.96
          ],
          [
            -27.52,
            -174.08
          ],
          [
            -23.04,
            -212.48
          ],
          [
            23.04,
            -212.48
          ]
        ],
        "patrolSpeed": 3.8,
        "chaseSpeed": 7.8,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.2
      }
    ],
    "lights": [
      {
        "position": [
          0,
          12,
          -12.8
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          12,
          -51.2
        ],
        "intensity": 1.5,
        "flickering": true
      },
      {
        "position": [
          12.8,
          12,
          -87.04
        ],
        "intensity": 1.4
      },
      {
        "position": [
          -12.8,
          12,
          -122.88
        ],
        "intensity": 1.5,
        "flickering": true
      },
      {
        "position": [
          0,
          12.5,
          -163.84
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          12.5,
          -204.8
        ],
        "intensity": 1.6
      }
    ]
  },
  {
    "id": 6,
    "code": "SECTOR 06",
    "name": "Labyrinth of Sluices",
    "subtitle": "Thread baffled sluice locks and high-speed piston walkways in deep flooded corridors.",
    "difficulty": "High",
    "timeLimit": 340,
    "parTimes": [
      95,
      144,
      207
    ],
    "fogColor": "#485458",
    "fogDensity": 0.02,
    "ambientTint": "#687a80",
    "rooms": [
      {
        "center": [
          0,
          -64
        ],
        "size": [
          66.56,
          145.92
        ],
        "ceilingY": 10,
        "floorY": -4.2,
        "waterY": 0
      },
      {
        "center": [
          0,
          -186.88
        ],
        "size": [
          66.56,
          117.76
        ],
        "ceilingY": 10.5,
        "floorY": -4.4,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -33.28,
      "maxX": 33.28,
      "minZ": -243.2,
      "maxZ": 10.24,
      "floorY": -4.4,
      "waterY": 0,
      "ceilingY": 10.5
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -235.52
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s6_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s6_p1",
        "kind": "static",
        "position": [
          -7.167,
          0.28,
          -3.364
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_p2",
        "kind": "static",
        "position": [
          -12.184,
          0.275,
          -9.186
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p3",
        "kind": "static",
        "position": [
          -15.565,
          0.275,
          -15.548
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p4",
        "kind": "static",
        "position": [
          -16.913,
          0.28,
          -22.061
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p5",
        "kind": "static",
        "position": [
          -17.26,
          0.28,
          -28.676
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_p6",
        "kind": "static",
        "position": [
          -17.117,
          0.275,
          -35.196
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p7",
        "kind": "static",
        "position": [
          -16.711,
          0.275,
          -41.618
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p8",
        "kind": "static",
        "position": [
          -15.748,
          0.28,
          -48.144
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p9",
        "kind": "static",
        "position": [
          -14.468,
          0.28,
          -54.771
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_cp1",
        "kind": "static",
        "position": [
          -13,
          0.34,
          -62
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p10",
        "kind": "static",
        "position": [
          -16.225,
          0.275,
          -68.821
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p11",
        "kind": "static",
        "position": [
          -17.948,
          0.275,
          -74.941
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p12",
        "kind": "static",
        "position": [
          -17.87,
          0.28,
          -81.158
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p13",
        "kind": "static",
        "position": [
          -16.745,
          0.28,
          -87.473
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_p14",
        "kind": "static",
        "position": [
          -13.324,
          0.275,
          -93.644
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p15",
        "kind": "static",
        "position": [
          -7.453,
          0.275,
          -97.67
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p16",
        "kind": "static",
        "position": [
          -1.251,
          0.28,
          -100.393
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p17",
        "kind": "static",
        "position": [
          5.047,
          0.28,
          -103.086
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_p18",
        "kind": "static",
        "position": [
          11.121,
          0.275,
          -106.871
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p19",
        "kind": "static",
        "position": [
          12.361,
          0.275,
          -112.961
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p20",
        "kind": "static",
        "position": [
          9.593,
          0.28,
          -119.15
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_cp2",
        "kind": "static",
        "position": [
          5.5,
          0.34,
          -126
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p21",
        "kind": "static",
        "position": [
          11.355,
          0.28,
          -131.931
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_p22",
        "kind": "static",
        "position": [
          15.853,
          0.275,
          -137.653
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p23",
        "kind": "static",
        "position": [
          16.594,
          0.275,
          -143.696
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p24",
        "kind": "static",
        "position": [
          12.73,
          0.28,
          -149.694
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p25",
        "kind": "static",
        "position": [
          7.609,
          0.28,
          -155.15
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_p26",
        "kind": "static",
        "position": [
          2.495,
          0.275,
          -160.423
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p27",
        "kind": "static",
        "position": [
          -2.582,
          0.275,
          -165.537
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p28",
        "kind": "static",
        "position": [
          -7.594,
          0.28,
          -170.904
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p29",
        "kind": "static",
        "position": [
          -7.275,
          0.28,
          -177.152
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_cp3",
        "kind": "static",
        "position": [
          -4,
          0.34,
          -184
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p30",
        "kind": "static",
        "position": [
          -9.65,
          0.275,
          -190.24
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p31",
        "kind": "static",
        "position": [
          -14.104,
          0.275,
          -196.104
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p32",
        "kind": "static",
        "position": [
          -14.723,
          0.28,
          -202.485
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p33",
        "kind": "static",
        "position": [
          -8.53,
          0.28,
          -206.867
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_p34",
        "kind": "static",
        "position": [
          -2.153,
          0.275,
          -209.726
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_p35",
        "kind": "static",
        "position": [
          4.121,
          0.275,
          -212.46
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s6_p36",
        "kind": "static",
        "position": [
          10.416,
          0.28,
          -216.093
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s6_p37",
        "kind": "static",
        "position": [
          11.52,
          0.28,
          -222.563
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s6_p38",
        "kind": "static",
        "position": [
          6.974,
          0.275,
          -228.517
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s6_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -235.52
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          15.36,
          5,
          -46.08
        ],
        "size": [
          20.48,
          10,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          2.56,
          5,
          -75.52
        ],
        "size": [
          20.48,
          10,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          -22.4,
          5,
          -112.64
        ],
        "size": [
          16.64,
          10,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          -23.68,
          5,
          -161.28
        ],
        "size": [
          16.64,
          10,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          20.48,
          5,
          -161.28
        ],
        "size": [
          17.92,
          10,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          -20.48,
          5,
          -212.48
        ],
        "size": [
          2.82,
          10.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          5,
          -212.48
        ],
        "size": [
          2.82,
          10.5,
          2.82
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          -13,
          0.68,
          -62
        ]
      },
      {
        "id": "cp2",
        "position": [
          5.5,
          0.68,
          -126
        ]
      },
      {
        "id": "cp3",
        "position": [
          -4,
          0.68,
          -184
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -23.04,
            -12.8
          ],
          [
            23.04,
            -12.8
          ],
          [
            23.04,
            -58.88
          ],
          [
            -23.04,
            -64
          ]
        ],
        "patrolSpeed": 3.6,
        "chaseSpeed": 7.5,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.15
      },
      {
        "id": "m2",
        "waypoints": [
          [
            -23.04,
            -92.16
          ],
          [
            23.04,
            -92.16
          ],
          [
            23.04,
            -143.36
          ],
          [
            -23.04,
            -143.36
          ]
        ],
        "patrolSpeed": 3.7,
        "chaseSpeed": 7.7,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.2
      },
      {
        "id": "m3",
        "waypoints": [
          [
            -23.04,
            -168.96
          ],
          [
            23.04,
            -168.96
          ],
          [
            23.04,
            -225.28
          ],
          [
            -23.04,
            -225.28
          ]
        ],
        "patrolSpeed": 3.8,
        "chaseSpeed": 7.9,
        "detectionRadius": 0,
        "waterDetectionRadius": 122,
        "scale": 1.25
      }
    ],
    "lights": [
      {
        "position": [
          0,
          9.2,
          -15.36
        ],
        "intensity": 1.5
      },
      {
        "position": [
          -10.24,
          9.2,
          -48.64
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          10.24,
          9.2,
          -81.92
        ],
        "intensity": 1.5
      },
      {
        "position": [
          -7.68,
          9.6,
          -120.32
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          9.6,
          -161.28
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          9.6,
          -202.24
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          9.6,
          -230.4
        ],
        "intensity": 1.6
      }
    ]
  },
  {
    "id": 7,
    "code": "SECTOR 07",
    "name": "Flooded Cathedral",
    "subtitle": "Ascend towering cathedral naves while three deep-water leviathans circle below.",
    "difficulty": "High",
    "timeLimit": 350,
    "parTimes": [
      102,
      154,
      220
    ],
    "fogColor": "#455156",
    "fogDensity": 0.019,
    "ambientTint": "#66787e",
    "rooms": [
      {
        "center": [
          0,
          -69.12
        ],
        "size": [
          74.24,
          156.16
        ],
        "ceilingY": 14,
        "floorY": -4.5,
        "waterY": 0
      },
      {
        "center": [
          0,
          -199.68
        ],
        "size": [
          74.24,
          117.76
        ],
        "ceilingY": 14.5,
        "floorY": -4.6,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -37.12,
      "maxX": 37.12,
      "minZ": -258.56,
      "maxZ": 10.24,
      "floorY": -4.6,
      "waterY": 0,
      "ceilingY": 14.5
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -250.88
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s7_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s7_p1",
        "kind": "static",
        "position": [
          7.064,
          0.28,
          -3.135
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p2",
        "kind": "static",
        "position": [
          11.982,
          0.275,
          -8.727
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_p3",
        "kind": "static",
        "position": [
          15.33,
          0.28,
          -14.962
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p4",
        "kind": "static",
        "position": [
          16.799,
          0.275,
          -21.227
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_p5",
        "kind": "static",
        "position": [
          17.143,
          0.28,
          -27.494
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p6",
        "kind": "static",
        "position": [
          16.314,
          0.275,
          -33.761
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_p7",
        "kind": "static",
        "position": [
          14.073,
          0.28,
          -40.03
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p8",
        "kind": "static",
        "position": [
          10.198,
          0.275,
          -46.156
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_p9",
        "kind": "static",
        "position": [
          5.66,
          0.28,
          -52.002
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p10",
        "kind": "static",
        "position": [
          0.849,
          0.275,
          -57.68
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_cp1",
        "kind": "static",
        "position": [
          -4.5,
          0.34,
          -64
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p11",
        "kind": "static",
        "position": [
          -8.684,
          0.28,
          -71.454
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p12",
        "kind": "static",
        "position": [
          -12.198,
          0.275,
          -78.202
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_p13",
        "kind": "static",
        "position": [
          -14.766,
          0.28,
          -84.999
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p14",
        "kind": "static",
        "position": [
          -15.95,
          0.275,
          -91.794
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_p15",
        "kind": "static",
        "position": [
          -16.305,
          0.28,
          -98.589
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p16",
        "kind": "static",
        "position": [
          -15.513,
          0.275,
          -105.382
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_p17",
        "kind": "static",
        "position": [
          -12.824,
          0.28,
          -112.174
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p18",
        "kind": "static",
        "position": [
          -7.833,
          0.275,
          -118.356
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_p19",
        "kind": "static",
        "position": [
          -2.095,
          0.28,
          -123.918
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_cp2",
        "kind": "static",
        "position": [
          4.5,
          0.34,
          -130
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p20",
        "kind": "static",
        "position": [
          8.655,
          0.275,
          -136.72
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_p21",
        "kind": "static",
        "position": [
          12.172,
          0.28,
          -142.847
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p22",
        "kind": "static",
        "position": [
          14.751,
          0.275,
          -149.033
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_p23",
        "kind": "static",
        "position": [
          15.845,
          0.28,
          -155.217
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p24",
        "kind": "static",
        "position": [
          16.015,
          0.275,
          -161.401
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_p25",
        "kind": "static",
        "position": [
          15.239,
          0.28,
          -167.585
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p26",
        "kind": "static",
        "position": [
          13.259,
          0.275,
          -173.768
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_p27",
        "kind": "static",
        "position": [
          9.568,
          0.28,
          -179.853
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p28",
        "kind": "static",
        "position": [
          5.124,
          0.275,
          -185.649
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_cp3",
        "kind": "static",
        "position": [
          0,
          0.34,
          -192
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p29",
        "kind": "static",
        "position": [
          -6.347,
          0.28,
          -197.932
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p30",
        "kind": "static",
        "position": [
          -11.763,
          0.275,
          -203.411
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_p31",
        "kind": "static",
        "position": [
          -15.209,
          0.28,
          -209.871
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p32",
        "kind": "static",
        "position": [
          -11.115,
          0.275,
          -216.169
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_p33",
        "kind": "static",
        "position": [
          -4.721,
          0.28,
          -219.939
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p34",
        "kind": "static",
        "position": [
          1.755,
          0.275,
          -223.244
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_p35",
        "kind": "static",
        "position": [
          8.202,
          0.28,
          -226.747
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "concrete"
      },
      {
        "id": "s7_p36",
        "kind": "static",
        "position": [
          13.94,
          0.275,
          -231.859
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "caution"
      },
      {
        "id": "s7_p37",
        "kind": "static",
        "position": [
          12.51,
          0.28,
          -238.355
        ],
        "size": [
          3,
          0.56,
          3
        ],
        "accent": "tile"
      },
      {
        "id": "s7_p38",
        "kind": "static",
        "position": [
          7.378,
          0.275,
          -244.074
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "metal"
      },
      {
        "id": "s7_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -250.88
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          -23.04,
          7,
          -30.72
        ],
        "size": [
          3.07,
          14.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          7,
          -30.72
        ],
        "size": [
          3.07,
          14.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -23.04,
          7,
          -87.04
        ],
        "size": [
          3.07,
          14.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          25.6,
          7,
          -87.04
        ],
        "size": [
          3.07,
          14.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -23.04,
          7,
          -143.36
        ],
        "size": [
          3.07,
          14.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          7,
          -143.36
        ],
        "size": [
          3.07,
          14.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -23.04,
          7,
          -207.36
        ],
        "size": [
          3.07,
          14.5,
          3.07
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          7,
          -207.36
        ],
        "size": [
          3.07,
          14.5,
          3.07
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          -4.5,
          0.68,
          -64
        ]
      },
      {
        "id": "cp2",
        "position": [
          4.5,
          0.68,
          -130
        ]
      },
      {
        "id": "cp3",
        "position": [
          0,
          0.68,
          -192
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -25.6,
            -12.8
          ],
          [
            25.6,
            -12.8
          ],
          [
            25.6,
            -76.8
          ],
          [
            -25.6,
            -76.8
          ]
        ],
        "patrolSpeed": 3.6,
        "chaseSpeed": 7.7,
        "detectionRadius": 0,
        "waterDetectionRadius": 128,
        "scale": 1.15
      },
      {
        "id": "m2",
        "waypoints": [
          [
            25.6,
            -97.28
          ],
          [
            -25.6,
            -97.28
          ],
          [
            -25.6,
            -168.96
          ],
          [
            25.6,
            -168.96
          ]
        ],
        "patrolSpeed": 3.8,
        "chaseSpeed": 7.9,
        "detectionRadius": 0,
        "waterDetectionRadius": 128,
        "scale": 1.2
      },
      {
        "id": "m3",
        "waypoints": [
          [
            -25.6,
            -181.76
          ],
          [
            25.6,
            -181.76
          ],
          [
            25.6,
            -240.64
          ],
          [
            -25.6,
            -240.64
          ]
        ],
        "patrolSpeed": 4,
        "chaseSpeed": 8.2,
        "detectionRadius": 0,
        "waterDetectionRadius": 128,
        "scale": 1.25
      }
    ],
    "lights": [
      {
        "position": [
          0,
          13,
          -17.92
        ],
        "intensity": 1.6
      },
      {
        "position": [
          0,
          13,
          -61.44
        ],
        "intensity": 1.5,
        "flickering": true
      },
      {
        "position": [
          0,
          13,
          -107.52
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          13.2,
          -153.6
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          13.2,
          -199.68
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          13.2,
          -240.64
        ],
        "intensity": 1.6
      }
    ]
  },
  {
    "id": 8,
    "code": "SECTOR 08",
    "name": "Submerged Conduit Maze",
    "subtitle": "Weave through vast partitioned floodgate chambers and criss-crossing pipe bridges.",
    "difficulty": "Severe",
    "timeLimit": 386,
    "parTimes": [
      110,
      166,
      237
    ],
    "fogColor": "#3f4a4f",
    "fogDensity": 0.02,
    "ambientTint": "#5e7076",
    "rooms": [
      {
        "center": [
          0,
          -71.68
        ],
        "size": [
          76.8,
          161.28
        ],
        "ceilingY": 10.5,
        "floorY": -4.4,
        "waterY": 0
      },
      {
        "center": [
          0,
          -209.92
        ],
        "size": [
          76.8,
          122.88
        ],
        "ceilingY": 11,
        "floorY": -4.5,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -38.4,
      "maxX": 38.4,
      "minZ": -271.36,
      "maxZ": 10.24,
      "floorY": -4.5,
      "waterY": 0,
      "ceilingY": 11
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -263.68
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s8_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s8_p1",
        "kind": "static",
        "position": [
          -7.548,
          0.275,
          -3.266
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p2",
        "kind": "static",
        "position": [
          -12.829,
          0.275,
          -8.927
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p3",
        "kind": "static",
        "position": [
          -16.538,
          0.275,
          -15.424
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p4",
        "kind": "static",
        "position": [
          -18.153,
          0.275,
          -22.053
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p5",
        "kind": "static",
        "position": [
          -18.202,
          0.275,
          -28.682
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p6",
        "kind": "static",
        "position": [
          -16.329,
          0.275,
          -35.313
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p7",
        "kind": "static",
        "position": [
          -11.942,
          0.275,
          -41.563
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p8",
        "kind": "static",
        "position": [
          -6.461,
          0.275,
          -47.043
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p9",
        "kind": "static",
        "position": [
          -0.667,
          0.275,
          -52.169
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_cp1",
        "kind": "static",
        "position": [
          6,
          0.34,
          -58
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p10",
        "kind": "static",
        "position": [
          11.134,
          0.275,
          -64.472
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p11",
        "kind": "static",
        "position": [
          14.908,
          0.275,
          -70.53
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p12",
        "kind": "static",
        "position": [
          16.344,
          0.275,
          -76.753
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p13",
        "kind": "static",
        "position": [
          16.445,
          0.275,
          -82.972
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p14",
        "kind": "static",
        "position": [
          15.397,
          0.275,
          -89.186
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p15",
        "kind": "static",
        "position": [
          12.462,
          0.275,
          -95.386
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p16",
        "kind": "static",
        "position": [
          6.868,
          0.275,
          -100.053
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p17",
        "kind": "static",
        "position": [
          0.706,
          0.275,
          -103.208
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p18",
        "kind": "static",
        "position": [
          -5.474,
          0.275,
          -106.084
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p19",
        "kind": "static",
        "position": [
          -11.577,
          0.275,
          -109.503
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p20",
        "kind": "static",
        "position": [
          -14.236,
          0.275,
          -115.675
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p21",
        "kind": "static",
        "position": [
          -10.547,
          0.275,
          -121.7
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_cp2",
        "kind": "static",
        "position": [
          -5,
          0.34,
          -128
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p22",
        "kind": "static",
        "position": [
          -10.921,
          0.275,
          -134.08
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p23",
        "kind": "static",
        "position": [
          -15.751,
          0.275,
          -139.782
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p24",
        "kind": "static",
        "position": [
          -17.983,
          0.275,
          -146.166
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p25",
        "kind": "static",
        "position": [
          -14.525,
          0.275,
          -152.476
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p26",
        "kind": "static",
        "position": [
          -9.283,
          0.275,
          -157.856
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p27",
        "kind": "static",
        "position": [
          -4.004,
          0.275,
          -163.208
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p28",
        "kind": "static",
        "position": [
          -0.559,
          0.275,
          -169.538
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p29",
        "kind": "static",
        "position": [
          -0.015,
          0.275,
          -175.949
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p30",
        "kind": "static",
        "position": [
          0.106,
          0.275,
          -182.363
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p31",
        "kind": "static",
        "position": [
          0.126,
          0.275,
          -188.781
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_cp3",
        "kind": "static",
        "position": [
          0,
          0.34,
          -196
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p32",
        "kind": "static",
        "position": [
          5.977,
          0.275,
          -201.71
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p33",
        "kind": "static",
        "position": [
          11.17,
          0.275,
          -206.808
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p34",
        "kind": "static",
        "position": [
          15.335,
          0.275,
          -212.639
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p35",
        "kind": "static",
        "position": [
          15.661,
          0.275,
          -218.792
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p36",
        "kind": "static",
        "position": [
          10.494,
          0.275,
          -223.901
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p37",
        "kind": "static",
        "position": [
          4.535,
          0.275,
          -227.71
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p38",
        "kind": "static",
        "position": [
          -1.507,
          0.275,
          -231.214
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p39",
        "kind": "static",
        "position": [
          -7.509,
          0.275,
          -234.849
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_p40",
        "kind": "static",
        "position": [
          -13.171,
          0.275,
          -239.271
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s8_p41",
        "kind": "static",
        "position": [
          -15.142,
          0.275,
          -245.392
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s8_p42",
        "kind": "static",
        "position": [
          -11.917,
          0.275,
          -251.47
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s8_p43",
        "kind": "static",
        "position": [
          -7.02,
          0.275,
          -256.785
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s8_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -263.68
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          10.24,
          5,
          -25.6
        ],
        "size": [
          28.16,
          10.5,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          -12.8,
          5,
          -74.24
        ],
        "size": [
          28.16,
          10.5,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          22.4,
          5,
          -122.88
        ],
        "size": [
          20.48,
          10.5,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          -20.48,
          5,
          -179.2
        ],
        "size": [
          20.48,
          10.5,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          20.48,
          5,
          -179.2
        ],
        "size": [
          20.48,
          10.5,
          2.3
        ],
        "kind": "tile"
      },
      {
        "position": [
          -23.04,
          5.2,
          -225.28
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          5.2,
          -225.28
        ],
        "size": [
          2.82,
          11,
          2.82
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          6,
          0.68,
          -58
        ]
      },
      {
        "id": "cp2",
        "position": [
          -5,
          0.68,
          -128
        ]
      },
      {
        "id": "cp3",
        "position": [
          0,
          0.68,
          -196
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -30.72,
            -10.24
          ],
          [
            -30.72,
            -48.64
          ],
          [
            28.16,
            -48.64
          ],
          [
            28.16,
            -7.68
          ]
        ],
        "patrolSpeed": 3.7,
        "chaseSpeed": 7.9,
        "detectionRadius": 0,
        "waterDetectionRadius": 128,
        "scale": 1.2
      },
      {
        "id": "m2",
        "waypoints": [
          [
            -30.72,
            -89.6
          ],
          [
            30.72,
            -89.6
          ],
          [
            30.72,
            -156.16
          ],
          [
            -30.72,
            -156.16
          ]
        ],
        "patrolSpeed": 3.9,
        "chaseSpeed": 8.1,
        "detectionRadius": 0,
        "waterDetectionRadius": 134,
        "scale": 1.25
      },
      {
        "id": "m3",
        "waypoints": [
          [
            -28.16,
            -194.56
          ],
          [
            28.16,
            -194.56
          ],
          [
            28.16,
            -250.88
          ],
          [
            -28.16,
            -250.88
          ]
        ],
        "patrolSpeed": 4.1,
        "chaseSpeed": 8.4,
        "detectionRadius": 0,
        "waterDetectionRadius": 134,
        "scale": 1.3
      }
    ],
    "lights": [
      {
        "position": [
          -15.36,
          9.8,
          -20.48
        ],
        "intensity": 1.4
      },
      {
        "position": [
          10.24,
          9.8,
          -53.76
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          17.92,
          9.8,
          -87.04
        ],
        "intensity": 1.4
      },
      {
        "position": [
          -10.24,
          9.8,
          -122.88
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          10.2,
          -163.84
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          10.2,
          -209.92
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          10.2,
          -250.88
        ],
        "intensity": 1.6
      }
    ]
  },
  {
    "id": 9,
    "code": "SECTOR 09",
    "name": "Abyssal Gauntlet",
    "subtitle": "Full-sprint parkour over black depths. Hesitate on a collapsing tile and drop to the swarm.",
    "difficulty": "Severe",
    "timeLimit": 419,
    "parTimes": [
      117,
      176,
      250
    ],
    "fogColor": "#3a4448",
    "fogDensity": 0.02,
    "ambientTint": "#58696e",
    "rooms": [
      {
        "center": [
          0,
          -74.24
        ],
        "size": [
          71.68,
          168.96
        ],
        "ceilingY": 12,
        "floorY": -4.8,
        "waterY": 0
      },
      {
        "center": [
          0,
          -220.16
        ],
        "size": [
          71.68,
          133.12
        ],
        "ceilingY": 12.5,
        "floorY": -5,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -35.84,
      "maxX": 35.84,
      "minZ": -286.72,
      "maxZ": 10.24,
      "floorY": -5,
      "waterY": 0,
      "ceilingY": 12.5
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -279.04
      ],
      "size": [
        4.32,
        3.6,
        1.65
      ]
    },
    "platforms": [
      {
        "id": "s9_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s9_p1",
        "kind": "static",
        "position": [
          6.553,
          0.275,
          -3.718
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p2",
        "kind": "static",
        "position": [
          10.936,
          0.275,
          -9.713
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p3",
        "kind": "static",
        "position": [
          13.685,
          0.275,
          -16.113
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p4",
        "kind": "static",
        "position": [
          15.364,
          0.275,
          -22.514
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p5",
        "kind": "static",
        "position": [
          16.125,
          0.275,
          -28.916
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p6",
        "kind": "static",
        "position": [
          15.256,
          0.275,
          -35.318
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p7",
        "kind": "static",
        "position": [
          10.705,
          0.275,
          -41.226
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p8",
        "kind": "static",
        "position": [
          4.396,
          0.275,
          -44.758
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p9",
        "kind": "static",
        "position": [
          -2.004,
          0.275,
          -47.662
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p10",
        "kind": "static",
        "position": [
          -8.378,
          0.275,
          -50.847
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p11",
        "kind": "static",
        "position": [
          -12.594,
          0.275,
          -56.929
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p12",
        "kind": "static",
        "position": [
          -9.642,
          0.275,
          -63.328
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_cp1",
        "kind": "static",
        "position": [
          -4.5,
          0.34,
          -70
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p13",
        "kind": "static",
        "position": [
          -9.069,
          0.275,
          -76.987
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p14",
        "kind": "static",
        "position": [
          -12.476,
          0.275,
          -83.263
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p15",
        "kind": "static",
        "position": [
          -14.302,
          0.275,
          -89.608
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p16",
        "kind": "static",
        "position": [
          -15.262,
          0.275,
          -95.95
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p17",
        "kind": "static",
        "position": [
          -15.669,
          0.275,
          -102.29
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p18",
        "kind": "static",
        "position": [
          -15.119,
          0.275,
          -108.626
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p19",
        "kind": "static",
        "position": [
          -12.213,
          0.275,
          -114.954
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p20",
        "kind": "static",
        "position": [
          -6.024,
          0.275,
          -118.654
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p21",
        "kind": "static",
        "position": [
          0.302,
          0.275,
          -120.834
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p22",
        "kind": "static",
        "position": [
          6.625,
          0.275,
          -122.87
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p23",
        "kind": "static",
        "position": [
          12.516,
          0.275,
          -127.283
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p24",
        "kind": "static",
        "position": [
          9.927,
          0.275,
          -133.602
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_cp2",
        "kind": "static",
        "position": [
          4.5,
          0.34,
          -140
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p25",
        "kind": "static",
        "position": [
          9.742,
          0.275,
          -146.991
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p26",
        "kind": "static",
        "position": [
          13.853,
          0.275,
          -153.328
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p27",
        "kind": "static",
        "position": [
          15.483,
          0.275,
          -159.929
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p28",
        "kind": "static",
        "position": [
          11.476,
          0.275,
          -166.305
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p29",
        "kind": "static",
        "position": [
          5.288,
          0.275,
          -170.751
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p30",
        "kind": "static",
        "position": [
          -1.098,
          0.275,
          -174.728
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p31",
        "kind": "static",
        "position": [
          -7.417,
          0.275,
          -178.882
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p32",
        "kind": "static",
        "position": [
          -13.062,
          0.275,
          -184.138
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p33",
        "kind": "static",
        "position": [
          -13.867,
          0.275,
          -190.737
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p34",
        "kind": "static",
        "position": [
          -10.465,
          0.275,
          -197.273
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p35",
        "kind": "static",
        "position": [
          -5.674,
          0.275,
          -203.263
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_cp3",
        "kind": "static",
        "position": [
          0,
          0.34,
          -210
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p36",
        "kind": "static",
        "position": [
          -6.104,
          0.275,
          -216.201
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p37",
        "kind": "static",
        "position": [
          -11.335,
          0.275,
          -221.858
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p38",
        "kind": "static",
        "position": [
          -14.977,
          0.275,
          -228.333
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p39",
        "kind": "static",
        "position": [
          -13.177,
          0.275,
          -234.921
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p40",
        "kind": "static",
        "position": [
          -7.221,
          0.275,
          -239.739
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p41",
        "kind": "static",
        "position": [
          -0.868,
          0.275,
          -243.748
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p42",
        "kind": "static",
        "position": [
          5.49,
          0.275,
          -247.732
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_p43",
        "kind": "static",
        "position": [
          11.525,
          0.275,
          -252.399
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s9_p44",
        "kind": "static",
        "position": [
          14.226,
          0.275,
          -258.968
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s9_p45",
        "kind": "static",
        "position": [
          11.41,
          0.275,
          -265.533
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s9_p46",
        "kind": "static",
        "position": [
          6.669,
          0.275,
          -271.515
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s9_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -279.04
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          -20.48,
          6,
          -30.72
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          6,
          -30.72
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -21.76,
          6,
          -81.92
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          6,
          -81.92
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -20.48,
          6,
          -133.12
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          6,
          -133.12
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -20.48,
          6,
          -189.44
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          6,
          -189.44
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -20.48,
          6,
          -243.2
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      },
      {
        "position": [
          20.48,
          6,
          -243.2
        ],
        "size": [
          2.82,
          12.5,
          2.82
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          -4.5,
          0.68,
          -70
        ]
      },
      {
        "id": "cp2",
        "position": [
          4.5,
          0.68,
          -140
        ]
      },
      {
        "id": "cp3",
        "position": [
          0,
          0.68,
          -210
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -25.6,
            -12.8
          ],
          [
            25.6,
            -12.8
          ],
          [
            25.6,
            -87.04
          ],
          [
            -25.6,
            -87.04
          ]
        ],
        "patrolSpeed": 4,
        "chaseSpeed": 8.1,
        "detectionRadius": 0,
        "waterDetectionRadius": 134,
        "scale": 1.25
      },
      {
        "id": "m2",
        "waypoints": [
          [
            25.6,
            -104.96
          ],
          [
            -25.6,
            -104.96
          ],
          [
            -25.6,
            -181.76
          ],
          [
            25.6,
            -181.76
          ]
        ],
        "patrolSpeed": 4.1,
        "chaseSpeed": 8.3,
        "detectionRadius": 0,
        "waterDetectionRadius": 134,
        "scale": 1.25
      },
      {
        "id": "m3",
        "waypoints": [
          [
            -25.6,
            -199.68
          ],
          [
            25.6,
            -199.68
          ],
          [
            25.6,
            -263.68
          ],
          [
            -25.6,
            -263.68
          ]
        ],
        "patrolSpeed": 4.3,
        "chaseSpeed": 8.6,
        "detectionRadius": 0,
        "waterDetectionRadius": 141,
        "scale": 1.35
      }
    ],
    "lights": [
      {
        "position": [
          0,
          11.2,
          -20.48
        ],
        "intensity": 1.3,
        "flickering": true
      },
      {
        "position": [
          0,
          11.2,
          -61.44
        ],
        "intensity": 1.4
      },
      {
        "position": [
          0,
          11.2,
          -107.52
        ],
        "intensity": 1.3,
        "flickering": true
      },
      {
        "position": [
          0,
          11.5,
          -153.6
        ],
        "intensity": 1.4
      },
      {
        "position": [
          0,
          11.5,
          -202.24
        ],
        "intensity": 1.3,
        "flickering": true
      },
      {
        "position": [
          0,
          11.5,
          -253.44
        ],
        "intensity": 1.5
      }
    ]
  },
  {
    "id": 10,
    "code": "SECTOR 10",
    "name": "The Deep Drain",
    "subtitle": "Ascend the colossal flooded drain cathedral. Outlast four Apex Leviathans to reach the surface.",
    "difficulty": "Extreme",
    "timeLimit": 462,
    "parTimes": [
      134,
      201,
      287
    ],
    "fogColor": "#323c40",
    "fogDensity": 0.019,
    "ambientTint": "#526268",
    "rooms": [
      {
        "center": [
          0,
          -76.8
        ],
        "size": [
          81.92,
          179.2
        ],
        "ceilingY": 15,
        "floorY": -5.2,
        "waterY": 0
      },
      {
        "center": [
          0,
          -230.4
        ],
        "size": [
          81.92,
          153.6
        ],
        "ceilingY": 16,
        "floorY": -5.4,
        "waterY": 0
      }
    ],
    "bounds": {
      "minX": -40.96,
      "maxX": 40.96,
      "minZ": -307.2,
      "maxZ": 10.24,
      "floorY": -5.4,
      "waterY": 0,
      "ceilingY": 16
    },
    "spawn": [
      0,
      0.8,
      3.84
    ],
    "exit": {
      "position": [
        0,
        0.85,
        -299.52
      ],
      "size": [
        4.8,
        4,
        1.76
      ]
    },
    "platforms": [
      {
        "id": "s10_start",
        "kind": "static",
        "position": [
          0,
          0.4,
          3.84
        ],
        "size": [
          6.8,
          0.8,
          5.8
        ],
        "accent": "start"
      },
      {
        "id": "s10_p1",
        "kind": "static",
        "position": [
          -7.214,
          0.275,
          -3.106
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p2",
        "kind": "static",
        "position": [
          -12.072,
          0.275,
          -8.664
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p3",
        "kind": "static",
        "position": [
          -15.308,
          0.275,
          -14.906
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p4",
        "kind": "static",
        "position": [
          -17.058,
          0.275,
          -21.188
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p5",
        "kind": "static",
        "position": [
          -18.122,
          0.275,
          -27.471
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p6",
        "kind": "static",
        "position": [
          -18.302,
          0.275,
          -33.754
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p7",
        "kind": "static",
        "position": [
          -16.982,
          0.275,
          -40.038
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p8",
        "kind": "static",
        "position": [
          -12.128,
          0.275,
          -45.602
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p9",
        "kind": "static",
        "position": [
          -5.877,
          0.275,
          -48.789
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p10",
        "kind": "static",
        "position": [
          0.408,
          0.275,
          -51.31
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p11",
        "kind": "static",
        "position": [
          6.693,
          0.275,
          -53.916
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p12",
        "kind": "static",
        "position": [
          12.16,
          0.275,
          -58.896
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p13",
        "kind": "static",
        "position": [
          8.105,
          0.275,
          -64.915
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p14",
        "kind": "static",
        "position": [
          2.242,
          0.275,
          -69.302
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_cp1",
        "kind": "static",
        "position": [
          -4.5,
          0.34,
          -74
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p15",
        "kind": "static",
        "position": [
          -9.036,
          0.275,
          -81.208
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p16",
        "kind": "static",
        "position": [
          -12.772,
          0.275,
          -87.615
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p17",
        "kind": "static",
        "position": [
          -15.539,
          0.275,
          -94.16
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p18",
        "kind": "static",
        "position": [
          -16.831,
          0.275,
          -100.701
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p19",
        "kind": "static",
        "position": [
          -17.494,
          0.275,
          -107.236
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p20",
        "kind": "static",
        "position": [
          -17.213,
          0.275,
          -113.766
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p21",
        "kind": "static",
        "position": [
          -15.128,
          0.275,
          -120.288
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p22",
        "kind": "static",
        "position": [
          -9.516,
          0.275,
          -125.452
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p23",
        "kind": "static",
        "position": [
          -3.011,
          0.275,
          -128.265
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p24",
        "kind": "static",
        "position": [
          3.49,
          0.275,
          -130.493
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p25",
        "kind": "static",
        "position": [
          9.985,
          0.275,
          -132.828
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p26",
        "kind": "static",
        "position": [
          15.518,
          0.275,
          -138.048
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p27",
        "kind": "static",
        "position": [
          11.334,
          0.275,
          -144.234
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_cp2",
        "kind": "static",
        "position": [
          4.8,
          0.34,
          -150
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p28",
        "kind": "static",
        "position": [
          9.302,
          0.275,
          -156.738
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p29",
        "kind": "static",
        "position": [
          13.211,
          0.275,
          -162.738
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p30",
        "kind": "static",
        "position": [
          15.992,
          0.275,
          -168.95
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p31",
        "kind": "static",
        "position": [
          16.28,
          0.275,
          -175.161
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p32",
        "kind": "static",
        "position": [
          11.926,
          0.275,
          -180.956
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p33",
        "kind": "static",
        "position": [
          6.071,
          0.275,
          -185.187
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p34",
        "kind": "static",
        "position": [
          0.026,
          0.275,
          -188.928
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p35",
        "kind": "static",
        "position": [
          -6.02,
          0.275,
          -192.654
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p36",
        "kind": "static",
        "position": [
          -11.883,
          0.275,
          -196.846
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p37",
        "kind": "static",
        "position": [
          -16.171,
          0.275,
          -202.659
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p38",
        "kind": "static",
        "position": [
          -14.924,
          0.275,
          -208.851
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p39",
        "kind": "static",
        "position": [
          -10.786,
          0.275,
          -214.731
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p40",
        "kind": "static",
        "position": [
          -5.751,
          0.275,
          -220.024
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_cp3",
        "kind": "static",
        "position": [
          0,
          0.34,
          -226
        ],
        "size": [
          4.2,
          0.68,
          4.2
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p41",
        "kind": "static",
        "position": [
          6.055,
          0.275,
          -232.313
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p42",
        "kind": "static",
        "position": [
          11.24,
          0.275,
          -237.886
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p43",
        "kind": "static",
        "position": [
          15.318,
          0.275,
          -244.124
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p44",
        "kind": "static",
        "position": [
          15.773,
          0.275,
          -250.618
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p45",
        "kind": "static",
        "position": [
          10.68,
          0.275,
          -256.258
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p46",
        "kind": "static",
        "position": [
          4.535,
          0.275,
          -260.53
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p47",
        "kind": "static",
        "position": [
          -1.74,
          0.275,
          -264.468
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p48",
        "kind": "static",
        "position": [
          -7.95,
          0.275,
          -268.568
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_p49",
        "kind": "static",
        "position": [
          -13.627,
          0.275,
          -273.588
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "tile"
      },
      {
        "id": "s10_p50",
        "kind": "static",
        "position": [
          -15.058,
          0.275,
          -280.059
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "caution"
      },
      {
        "id": "s10_p51",
        "kind": "static",
        "position": [
          -11.764,
          0.275,
          -286.481
        ],
        "size": [
          2.8,
          0.55,
          2.8
        ],
        "accent": "concrete"
      },
      {
        "id": "s10_p52",
        "kind": "static",
        "position": [
          -6.843,
          0.275,
          -292.223
        ],
        "size": [
          2.6,
          0.55,
          2.6
        ],
        "accent": "metal"
      },
      {
        "id": "s10_exit",
        "kind": "static",
        "position": [
          0,
          0.425,
          -299.52
        ],
        "size": [
          6.8,
          0.85,
          5.8
        ],
        "accent": "exit"
      }
    ],
    "walls": [
      {
        "position": [
          -23.04,
          7.5,
          -28.16
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          7.5,
          -28.16
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -23.04,
          7.5,
          -76.8
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          26.88,
          7.5,
          -76.8
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -23.04,
          7.5,
          -128
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          7.5,
          -128
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -23.04,
          7.5,
          -181.76
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          7.5,
          -181.76
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          -23.04,
          7.5,
          -235.52
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      },
      {
        "position": [
          23.04,
          7.5,
          -235.52
        ],
        "size": [
          3.33,
          15.5,
          3.33
        ],
        "kind": "pillar"
      }
    ],
    "checkpoints": [
      {
        "id": "cp1",
        "position": [
          -4.5,
          0.68,
          -74
        ]
      },
      {
        "id": "cp2",
        "position": [
          4.8,
          0.68,
          -150
        ]
      },
      {
        "id": "cp3",
        "position": [
          0,
          0.68,
          -226
        ]
      }
    ],
    "monsters": [
      {
        "id": "m1",
        "waypoints": [
          [
            -30.72,
            -12.8
          ],
          [
            30.72,
            -12.8
          ],
          [
            30.72,
            -81.92
          ],
          [
            -30.72,
            -81.92
          ]
        ],
        "patrolSpeed": 4.1,
        "chaseSpeed": 8.3,
        "detectionRadius": 0,
        "waterDetectionRadius": 141,
        "scale": 1.25
      },
      {
        "id": "m2",
        "waypoints": [
          [
            30.72,
            -97.28
          ],
          [
            -30.72,
            -97.28
          ],
          [
            -30.72,
            -168.96
          ],
          [
            30.72,
            -168.96
          ]
        ],
        "patrolSpeed": 4.2,
        "chaseSpeed": 8.5,
        "detectionRadius": 0,
        "waterDetectionRadius": 141,
        "scale": 1.3
      },
      {
        "id": "m3",
        "waypoints": [
          [
            -30.72,
            -179.2
          ],
          [
            30.72,
            -179.2
          ],
          [
            30.72,
            -240.64
          ],
          [
            -30.72,
            -240.64
          ]
        ],
        "patrolSpeed": 4.3,
        "chaseSpeed": 8.7,
        "detectionRadius": 0,
        "waterDetectionRadius": 141,
        "scale": 1.35
      },
      {
        "id": "m4",
        "waypoints": [
          [
            30.72,
            -245.76
          ],
          [
            -30.72,
            -245.76
          ],
          [
            -30.72,
            -291.84
          ],
          [
            30.72,
            -291.84
          ]
        ],
        "patrolSpeed": 4.5,
        "chaseSpeed": 9,
        "detectionRadius": 0,
        "waterDetectionRadius": 147,
        "scale": 1.5
      }
    ],
    "lights": [
      {
        "position": [
          0,
          14,
          -17.92
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          14,
          -61.44
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          14,
          -107.52
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          14.5,
          -153.6
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          14.5,
          -199.68
        ],
        "intensity": 1.5
      },
      {
        "position": [
          0,
          15,
          -245.76
        ],
        "intensity": 1.4,
        "flickering": true
      },
      {
        "position": [
          0,
          15,
          -289.28
        ],
        "color": "#8ad4b8",
        "intensity": 1.8
      }
    ]
  }
];
