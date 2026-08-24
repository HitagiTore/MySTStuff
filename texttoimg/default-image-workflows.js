/**
 * SD Helper - 默认图片生成工作流预设
 * 这些工作流可以直接导入到 ComfyUI 连接器中使用
 */

const DEFAULT_IMAGE_WORKFLOWS = {
    // 基础文生图工作流 (使用变量占位符)
    "基础文生图": {
        description: "最简单的文生图工作流，适合大多数模型",
        workflow: {
            "3": {
                "inputs": {
                    "seed": "%seed%",
                    "steps": "%steps%",
                    "cfg": "%cfg%",
                    "sampler_name": "%sampler%",
                    "scheduler": "%scheduler%",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "%model%"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": "%width%",
                    "height": "%height%",
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": "%prompt%",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "%negative%",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        },
        defaultParams: {
            steps: 20,
            cfg: 7,
            sampler: "euler",
            scheduler: "normal",
            width: 512,
            height: 768
        }
    },

    // SDXL 工作流
    "SDXL 基础": {
        description: "适用于 SDXL 模型的工作流",
        workflow: {
            "3": {
                "inputs": {
                    "seed": "%seed%",
                    "steps": "%steps%",
                    "cfg": "%cfg%",
                    "sampler_name": "%sampler%",
                    "scheduler": "%scheduler%",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "%model%"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": "%width%",
                    "height": "%height%",
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": "%prompt%",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "%negative%",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        },
        defaultParams: {
            steps: 25,
            cfg: 7,
            sampler: "dpmpp_2m",
            scheduler: "karras",
            width: 1024,
            height: 1024
        }
    },

    // 带 LoRA 的工作流
    "带LoRA文生图": {
        description: "支持一个LoRA的文生图工作流",
        workflow: {
            "3": {
                "inputs": {
                    "seed": "%seed%",
                    "steps": "%steps%",
                    "cfg": "%cfg%",
                    "sampler_name": "%sampler%",
                    "scheduler": "%scheduler%",
                    "denoise": 1,
                    "model": ["10", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "%model%"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": "%width%",
                    "height": "%height%",
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": "%prompt%",
                    "clip": ["10", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "%negative%",
                    "clip": ["10", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            },
            "10": {
                "inputs": {
                    "lora_name": "%lora1%",
                    "strength_model": "%lora1_strength%",
                    "strength_clip": "%lora1_clip%",
                    "model": ["4", 0],
                    "clip": ["4", 1]
                },
                "class_type": "LoraLoader"
            }
        },
        defaultParams: {
            steps: 20,
            cfg: 7,
            sampler: "euler",
            scheduler: "normal",
            width: 512,
            height: 768
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.SD_DEFAULT_IMAGE_WORKFLOWS = DEFAULT_IMAGE_WORKFLOWS;
}
