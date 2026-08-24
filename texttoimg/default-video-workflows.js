/**
 * SD Helper - 默认视频生成工作流预设
 * 这些工作流适用于 ComfyUI 图生视频功能
 */

const DEFAULT_VIDEO_WORKFLOWS = {
    // Wan2.2 nsfw 图生视频工作流
    "Wan2.2-nsfw-fastmove-Q6K": {
        description: "使用 Wan2.2 模型进行图生视频，需要安装相关节点",
        workflow: {
  "1": {
    "inputs": {
      "vae_name": "wan_2.1_vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "加载VAE"
    }
  },
  "2": {
    "inputs": {
      "shift": 5,
      "model": [
        "42",
        0
      ]
    },
    "class_type": "ModelSamplingSD3",
    "_meta": {
      "title": "采样算法（SD3）"
    }
  },
  "4": {
    "inputs": {
      "shift": 5,
      "model": [
        "41",
        0
      ]
    },
    "class_type": "ModelSamplingSD3",
    "_meta": {
      "title": "采样算法（SD3）"
    }
  },
  "5": {
    "inputs": {
      "fps": 16,
      "images": [
        "38",
        0
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "创建视频"
    }
  },
  "7": {
    "inputs": {
      "filename_prefix": "video/ComfyUI",
      "format": "auto",
      "codec": "auto",
      "video": [
        "5",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "保存视频"
    }
  },
  "9": {
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "length": "%frames%",
      "batch_size": 1,
      "positive": [
        "10",
        0
      ],
      "negative": [
        "20",
        0
      ],
      "vae": [
        "1",
        0
      ],
      "start_image": [
        "40",
        0
      ]
    },
    "class_type": "WanImageToVideo",
    "_meta": {
      "title": "Wan图像到视频"
    }
  },
  "10": {
    "inputs": {
      "text": "%prompt%",
      "clip": [
        "13",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "13": {
    "inputs": {
      "clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
      "type": "wan",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "加载CLIP"
    }
  },
  "14": {
    "inputs": {
      "add_noise": "disable",
      "noise_seed": 359471250799351,
      "steps": 4,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "start_at_step": 2,
      "end_at_step": 4,
      "return_with_leftover_noise": "disable",
      "model": [
        "2",
        0
      ],
      "positive": [
        "9",
        0
      ],
      "negative": [
        "9",
        1
      ],
      "latent_image": [
        "15",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "K采样器（高级）"
    }
  },
  "15": {
    "inputs": {
      "add_noise": "enable",
      "noise_seed": 1082837388461182,
      "steps": 4,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "start_at_step": 0,
      "end_at_step": 2,
      "return_with_leftover_noise": "enable",
      "model": [
        "4",
        0
      ],
      "positive": [
        "9",
        0
      ],
      "negative": [
        "9",
        1
      ],
      "latent_image": [
        "9",
        2
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "K采样器（高级）"
    }
  },
  "20": {
    "inputs": {
      "conditioning": [
        "10",
        0
      ]
    },
    "class_type": "ConditioningZeroOut",
    "_meta": {
      "title": "条件零化"
    }
  },
  "38": {
    "inputs": {
      "tile_size": 512,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "samples": [
        "39",
        0
      ],
      "vae": [
        "1",
        0
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE解码（分块）"
    }
  },
  "39": {
    "inputs": {
      "value": [
        "14",
        0
      ]
    },
    "class_type": "UnloadAllModels",
    "_meta": {
      "title": "UnloadAllModels"
    }
  },
  "40": {
    "inputs": {
      "base64_data": "%image%",
      "image_output": "Preview",
      "save_prefix": "ComfyUI"
    },
    "class_type": "easy loadImageBase64",
    "_meta": {
      "title": "加载图像（Base64）"
    }
  },
  "41": {
    "inputs": {
      "unet_name": "wan22EnhancedNSFWCameraPrompt_nsfwFASTMOVEV2Q6KH.gguf"
    },
    "class_type": "UnetLoaderGGUF",
    "_meta": {
      "title": "Unet Loader (GGUF)"
    }
  },
  "42": {
    "inputs": {
      "unet_name": "wan22EnhancedNSFWCameraPrompt_nsfwFASTMOVEV2Q6KL.gguf"
    },
    "class_type": "UnetLoaderGGUF",
    "_meta": {
      "title": "Unet Loader (GGUF)"
      }
    }
  },
        defaultParams: {
            width: 512,
            height: 512,
            frames: 81,
            fps: 16,
            steps: 20,
            cfg: 7
        }
    },
       // Wan2.2 nsfw 图生视频工作流
    "Wan2.2-nsfw-Q6K": {
        description: "使用 Wan2.2 模型进行图生视频，需要安装相关节点",
        workflow: {
  "1": {
    "inputs": {
      "vae_name": "wan_2.1_vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "加载VAE"
    }
  },
  "2": {
    "inputs": {
      "shift": 5,
      "model": [
        "42",
        0
      ]
    },
    "class_type": "ModelSamplingSD3",
    "_meta": {
      "title": "采样算法（SD3）"
    }
  },
  "4": {
    "inputs": {
      "shift": 5,
      "model": [
        "41",
        0
      ]
    },
    "class_type": "ModelSamplingSD3",
    "_meta": {
      "title": "采样算法（SD3）"
    }
  },
  "5": {
    "inputs": {
      "fps": 16,
      "images": [
        "38",
        0
      ]
    },
    "class_type": "CreateVideo",
    "_meta": {
      "title": "创建视频"
    }
  },
  "7": {
    "inputs": {
      "filename_prefix": "video/ComfyUI",
      "format": "auto",
      "codec": "auto",
      "video": [
        "5",
        0
      ]
    },
    "class_type": "SaveVideo",
    "_meta": {
      "title": "保存视频"
    }
  },
  "9": {
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "length": "%frames%",
      "batch_size": 1,
      "positive": [
        "10",
        0
      ],
      "negative": [
        "20",
        0
      ],
      "vae": [
        "1",
        0
      ],
      "start_image": [
        "40",
        0
      ]
    },
    "class_type": "WanImageToVideo",
    "_meta": {
      "title": "Wan图像到视频"
    }
  },
  "10": {
    "inputs": {
      "text": "%prompt%",
      "clip": [
        "13",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "13": {
    "inputs": {
      "clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
      "type": "wan",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "加载CLIP"
    }
  },
  "14": {
    "inputs": {
      "add_noise": "disable",
      "noise_seed": 359471250799351,
      "steps": 4,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "start_at_step": 2,
      "end_at_step": 4,
      "return_with_leftover_noise": "disable",
      "model": [
        "2",
        0
      ],
      "positive": [
        "9",
        0
      ],
      "negative": [
        "9",
        1
      ],
      "latent_image": [
        "15",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "K采样器（高级）"
    }
  },
  "15": {
    "inputs": {
      "add_noise": "enable",
      "noise_seed": 1082837388461182,
      "steps": 4,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "start_at_step": 0,
      "end_at_step": 2,
      "return_with_leftover_noise": "enable",
      "model": [
        "4",
        0
      ],
      "positive": [
        "9",
        0
      ],
      "negative": [
        "9",
        1
      ],
      "latent_image": [
        "9",
        2
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "K采样器（高级）"
    }
  },
  "20": {
    "inputs": {
      "conditioning": [
        "10",
        0
      ]
    },
    "class_type": "ConditioningZeroOut",
    "_meta": {
      "title": "条件零化"
    }
  },
  "38": {
    "inputs": {
      "tile_size": 512,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "samples": [
        "39",
        0
      ],
      "vae": [
        "1",
        0
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE解码（分块）"
    }
  },
  "39": {
    "inputs": {
      "value": [
        "14",
        0
      ]
    },
    "class_type": "UnloadAllModels",
    "_meta": {
      "title": "UnloadAllModels"
    }
  },
  "40": {
    "inputs": {
      "base64_data": "%image%",
      "image_output": "Preview",
      "save_prefix": "ComfyUI"
    },
    "class_type": "easy loadImageBase64",
    "_meta": {
      "title": "加载图像（Base64）"
    }
  },
  "41": {
    "inputs": {
      "unet_name": "wan22EnhancedNSFWCameraPrompt_nsfwV2Q6KH.gguf"
    },
    "class_type": "UnetLoaderGGUF",
    "_meta": {
      "title": "Unet Loader (GGUF)"
    }
  },
  "42": {
    "inputs": {
      "unet_name": "wan22EnhancedNSFWCameraPrompt_nsfwV2Q6KL.gguf"
    },
    "class_type": "UnetLoaderGGUF",
    "_meta": {
      "title": "Unet Loader (GGUF)"
      }
    }
  },
        defaultParams: {
            width: 512,
            height: 512,
            frames: 81,
            fps: 16,
            steps: 20,
            cfg: 7
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.SD_DEFAULT_VIDEO_WORKFLOWS = DEFAULT_VIDEO_WORKFLOWS;
}
