/**
 * SD Helper - ComfyUI 连接器
 * 实现与 ComfyUI 本地/远程服务器的连接
 * 
 * 通过 SillyTavern 后端 API 绕过 CORS 限制
 */

// 默认的基础文生图工作流 (API 格式)
const DEFAULT_WORKFLOW = {
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
};

const ComfyUIConnector = {
    id: 'comfyui',
    name: 'ComfyUI',
    description: '连接本地或远程 ComfyUI 服务器',
    icon: '🖼️',

    // 缓存的资源列表
    _cachedResources: null,

    // ============ SillyTavern 后端 API 代理 ============

    _getSTHeaders() {
        if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getRequestHeaders === 'function') {
            return { ...SillyTavern.getRequestHeaders(), 'Content-Type': 'application/json' };
        }
        return { 'Content-Type': 'application/json' };
    },

    async _stApiFetch(endpoint, body) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: this._getSTHeaders(),
            body: JSON.stringify(body)
        });
        return response;
    },

    // ============ 资源获取 ============

    /**
     * 直连获取 ComfyUI 资源列表（采样器、调度器、模型、LoRA）
     * 使用 gmFetch 绕过 CORS 限制
     */
    async fetchResourcesDirect(config) {
        const url = (config.serverUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
        const resources = { samplers: [], schedulers: [], models: [], loras: [], clips: [], vaes: [] };
        const safeFetch = window.SD_safeFetch || fetch;

        console.log('[ComfyUI] 尝试直连获取资源:', url);

        try {
            // 获取 object_info 以获取采样器、调度器信息
            const objectInfoRes = await safeFetch(`${url}/object_info/KSampler`);
            if (objectInfoRes.ok) {
                const data = await objectInfoRes.json();
                const ksamplerInfo = data.KSampler?.input?.required || {};
                resources.samplers = ksamplerInfo.sampler_name?.[0] || [];
                resources.schedulers = ksamplerInfo.scheduler?.[0] || [];
            }

            // 获取 Checkpoint 模型列表
            const modelsInfoRes = await safeFetch(`${url}/object_info/CheckpointLoaderSimple`);
            if (modelsInfoRes.ok) {
                const data = await modelsInfoRes.json();
                const modelList = data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
                resources.models = modelList.map(m => ({
                    value: m,
                    text: m.split('/').pop().split('\\').pop()
                }));
            }

            // 获取 UNET 模型列表并合并
            try {
                const unetInfoRes = await safeFetch(`${url}/object_info/UNETLoader`);
                if (unetInfoRes.ok) {
                    const data = await unetInfoRes.json();
                    const unetList = data.UNETLoader?.input?.required?.unet_name?.[0] || [];
                    const unetModels = unetList.map(m => ({
                        value: m,
                        text: '[UNET] ' + m.split('/').pop().split('\\').pop()
                    }));
                    resources.models = [...resources.models, ...unetModels];
                }
            } catch (e) {
                console.log('[ComfyUI] UNET 模型获取失败（可能不存在）:', e.message);
            }

            // 获取 LoRA 列表
            const loraInfoRes = await safeFetch(`${url}/object_info/LoraLoader`);
            if (loraInfoRes.ok) {
                const data = await loraInfoRes.json();
                const loraList = data.LoraLoader?.input?.required?.lora_name?.[0] || [];
                resources.loras = loraList.map(l => ({
                    value: l,
                    text: l.split('/').pop().split('\\').pop()
                }));
            }

            // 获取 CLIP 模型列表
            try {
                const clipInfoRes = await safeFetch(`${url}/object_info/CLIPLoader`);
                if (clipInfoRes.ok) {
                    const data = await clipInfoRes.json();
                    const clipList = data.CLIPLoader?.input?.required?.clip_name?.[0] || [];
                    resources.clips = clipList.map(c => ({
                        value: c,
                        text: c.split('/').pop().split('\\').pop()
                    }));
                }
            } catch (e) {
                console.log('[ComfyUI] CLIP 模型获取失败（可能不存在 CLIPLoader 节点）:', e.message);
            }

            // 获取 VAE 模型列表
            try {
                const vaeInfoRes = await safeFetch(`${url}/object_info/VAELoader`);
                if (vaeInfoRes.ok) {
                    const data = await vaeInfoRes.json();
                    const vaeList = data.VAELoader?.input?.required?.vae_name?.[0] || [];
                    resources.vaes = vaeList.map(v => ({
                        value: v,
                        text: v.split('/').pop().split('\\').pop()
                    }));
                }
            } catch (e) {
                console.log('[ComfyUI] VAE 模型获取失败（可能不存在 VAELoader 节点）:', e.message);
            }

            this._cachedResources = resources;
            console.log('[ComfyUI] 直连获取资源成功:', resources);
            return { success: true, resources, connectionMethod: 'direct' };
        } catch (e) {
            console.error('[ComfyUI] 直连获取资源失败:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * 通过酒馆后端获取 ComfyUI 资源列表（采样器、调度器、模型）
     * 注意：LoRA 列表无法通过酒馆后端获取
     */
    async fetchResourcesViaST(config) {
        const url = (config.serverUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
        const resources = { samplers: [], schedulers: [], models: [], loras: [], clips: [], vaes: [], lorasUnavailable: true };

        console.log('[ComfyUI] 通过酒馆后端获取资源:', url);

        try {
            // 获取采样器
            const samplersRes = await this._stApiFetch('/api/sd/comfy/samplers', { url });
            if (samplersRes.ok) {
                resources.samplers = await samplersRes.json();
            }

            // 获取调度器
            const schedulersRes = await this._stApiFetch('/api/sd/comfy/schedulers', { url });
            if (schedulersRes.ok) {
                resources.schedulers = await schedulersRes.json();
            }

            // 获取模型
            const modelsRes = await this._stApiFetch('/api/sd/comfy/models', { url });
            if (modelsRes.ok) {
                resources.models = await modelsRes.json();
            }

            // LoRA 无法通过酒馆后端获取，标记为不可用

            this._cachedResources = resources;
            console.log('[ComfyUI] 酒馆后端资源获取成功:', resources);
            return { success: true, resources, connectionMethod: 'sillytavern' };
        } catch (e) {
            console.error('[ComfyUI] 酒馆后端资源获取失败:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * 兼容旧版本的 fetchResources 方法
     */
    async fetchResources(config) {
        const result = await this.fetchResourcesViaST(config);
        return result.resources || { samplers: [], schedulers: [], models: [], loras: [] };
    },

    // ============ 核心方法 ============

    /**
     * 获取模型列表（直连优先，失败转酒馆后端）
     * 替代原 testConnection 方法
     */
    async fetchModels(config) {
        const url = (config.serverUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
        console.log('[ComfyUI] 获取模型 - 尝试直连:', url);

        // 1. 尝试直连
        const directResult = await this.fetchResourcesDirect(config);
        if (directResult.success) {
            return {
                success: true,
                message: '✅ 直连成功！已获取完整资源列表（含 LoRA）',
                resources: directResult.resources,
                connectionMethod: 'direct'
            };
        }

        console.log('[ComfyUI] 直连失败，尝试酒馆后端...');

        // 2. 直连失败，尝试酒馆后端
        const stResult = await this.fetchResourcesViaST(config);
        if (stResult.success) {
            return {
                success: true,
                message: '✅ 当前为酒馆后端连接，非直连无法获取 LoRA 列表，请手动输入。\n💡 提示：在 ComfyUI 启动命令添加 --enable-cors-header 参数可启用直连。',
                resources: stResult.resources,
                connectionMethod: 'sillytavern',
                lorasUnavailable: true
            };
        }

        // 3. 两种方式都失败
        return {
            success: false,
            message: `连接失败：请确保 ComfyUI 正在运行。\n直连错误: ${directResult.error}\n后端错误: ${stResult.error}`
        };
    },

    /**
     * 测试连接（保留用于兼容性，内部调用 fetchModels）
     */
    async testConnection(config) {
        return await this.fetchModels(config);
    },

    async generate(prompt, negative, params, config) {
        const url = (config.serverUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');

        console.log('[ComfyUI] 通过 SillyTavern 后端生成图片');
        console.log('[ComfyUI] 正向提示词:', prompt);
        console.log('[ComfyUI] 负向提示词:', negative);

        try {
            let workflowStr = typeof config.workflowJson === 'string'
                ? config.workflowJson
                : JSON.stringify(config.workflowJson);

            // 如果为空，使用默认工作流
            if (!workflowStr || workflowStr === '{}') {
                workflowStr = JSON.stringify(DEFAULT_WORKFLOW, null, 2);
                console.log('[ComfyUI] 使用默认工作流');
            }

            if (!workflowStr) {
                return { success: false, error: '无效的 Workflow JSON' };
            }

            // 变量替换（优先于节点ID模式）
            const seed = params.seed === -1 ? Math.floor(Math.random() * 2147483647) : params.seed;
            const dp = config.defaultParams || {};

            const VARIABLE_MAP = {
                '%prompt%': prompt,
                '%negative%': negative,
                '%seed%': seed,
                '%steps%': params.steps || dp.steps || 20,
                '%cfg%': params.cfg || dp.cfg || 7,
                '%width%': params.width || dp.width || 512,
                '%height%': params.height || dp.height || 768,
                '%denoise%': params.denoise || dp.denoise || 1.0,
                '%sampler%': dp.sampler || 'euler',
                '%scheduler%': dp.scheduler || 'normal',
                '%clip_skip%': dp.clipSkip || 1,
                '%model%': dp.model || '',
                '%clip%': dp.clip || '',
                '%vae%': dp.vae || '',
            };

            // LoRA 变量（只替换非空且已启用的 LoRA，保留工作流原有值）
            const loras = dp.loras || [];
            for (let i = 0; i < 5; i++) {
                const lora = loras[i] || {};
                // 只有当 LoRA 名称非空且已启用时才替换，否则保留工作流原有值
                if (lora.name && lora.name.trim() && lora.enabled !== false) {
                    VARIABLE_MAP[`%lora${i + 1}%`] = lora.name;
                    VARIABLE_MAP[`%lora${i + 1}_strength%`] = lora.modelStrength ?? 1;
                    VARIABLE_MAP[`%lora${i + 1}_clip%`] = lora.clipStrength ?? 1;
                }
                // 如果为空或未启用，不添加到 VARIABLE_MAP，让工作流保持原样
            }

            // 转义JSON字符串中的特殊字符
            const escapeForJson = (str) => {
                if (typeof str !== 'string') return str;
                return str
                    .replace(/\\/g, '\\\\')  // 反斜杠
                    .replace(/"/g, '\\"')   // 双引号
                    .replace(/\n/g, '\\n')  // 换行符
                    .replace(/\r/g, '\\r')  // 回车符
                    .replace(/\t/g, '\\t')  // 制表符
                    .replace(/[\x00-\x1f]/g, (char) => {  // 其他控制字符
                        return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
                    });
            };

            let hasVariables = false;
            for (const [varName, value] of Object.entries(VARIABLE_MAP)) {
                if (workflowStr.includes(varName)) {
                    // 字符串类型的值需要转义特殊字符
                    const replacement = typeof value === 'string' ? escapeForJson(value) : String(value);
                    workflowStr = workflowStr.split(varName).join(replacement);
                    hasVariables = true;
                    console.log(`[ComfyUI] 变量替换: ${varName} -> ${String(replacement).substring(0, 50)}...`);
                }
            }

            let workflow = JSON.parse(workflowStr);

            // 如果没有变量，使用节点ID映射模式
            if (!hasVariables) {
                const mappings = config.parameterMappings || {};
                console.log('[ComfyUI] 未检测到变量占位符，使用节点ID映射模式');

                if (mappings.prompt?.nodeId && workflow[mappings.prompt.nodeId]) {
                    workflow[mappings.prompt.nodeId].inputs[mappings.prompt.inputKey || 'text'] = prompt;
                }
                if (mappings.negative?.nodeId && workflow[mappings.negative.nodeId]) {
                    workflow[mappings.negative.nodeId].inputs[mappings.negative.inputKey || 'text'] = negative;
                }
                if (mappings.sampler?.nodeId && workflow[mappings.sampler.nodeId]) {
                    const samplerNode = workflow[mappings.sampler.nodeId].inputs;
                    if (params.steps) samplerNode.steps = params.steps;
                    if (params.cfg) samplerNode.cfg = params.cfg;
                    if (params.seed !== undefined) samplerNode.seed = seed;
                }
                if (mappings.size?.nodeId && workflow[mappings.size.nodeId]) {
                    const sizeNode = workflow[mappings.size.nodeId].inputs;
                    if (params.width) sizeNode.width = params.width;
                    if (params.height) sizeNode.height = params.height;
                }

                // LoRA 节点 ID 映射模式
                const lorasMappings = mappings.loras || [];
                const lorasConfig = dp.loras || [];
                for (let i = 0; i < lorasMappings.length && i < 5; i++) {
                    const loraMapping = lorasMappings[i];
                    const loraConfig = lorasConfig[i];

                    // 只有当节点存在、LoRA 配置存在且已启用时才替换
                    if (loraMapping?.nodeId && workflow[loraMapping.nodeId] && loraConfig) {
                        const loraNode = workflow[loraMapping.nodeId].inputs;

                        // 只有当 LoRA 名称非空且启用时才覆盖节点值
                        if (loraConfig.name && loraConfig.name.trim() && loraConfig.enabled !== false) {
                            loraNode[loraMapping.nameKey || 'lora_name'] = loraConfig.name;
                            loraNode[loraMapping.modelStrengthKey || 'strength_model'] = loraConfig.modelStrength ?? 1;
                            loraNode[loraMapping.clipStrengthKey || 'strength_clip'] = loraConfig.clipStrength ?? 1;
                            console.log(`[ComfyUI] LoRA 节点映射: ${loraMapping.nodeId} <- ${loraConfig.name}`);
                        }
                    }
                }
            }

            // 模型/CLIP/VAE 节点映射替换（无论是否有变量，都执行）
            // 因为工作流可能用了 %prompt% 变量但没有 %model% 变量，此时仍需通过节点ID替换模型
            const mappingsForModels = config.parameterMappings || {};

            // 根据工作流节点的 class_type 动态确定 inputKey（最可靠方案，不依赖 config 中的 inputKey）
            const getModelInputKey = (node) => {
                const ct = (node?.class_type || '').toLowerCase();
                if (ct.includes('unetloader') || ct === 'unetloader') return 'unet_name';
                return 'ckpt_name';
            };
            const getClipInputKey = (node) => {
                const ct = node?.class_type || '';
                if (ct === 'DualCLIPLoader') return 'clip_name1';
                return 'clip_name';
            };

            console.log('[ComfyUI] === 模型/CLIP/VAE 替换 ===');

            // 模型节点替换（从 class_type 判断 inputKey）
            if (mappingsForModels.model?.nodeId && workflow[mappingsForModels.model.nodeId] && dp.model) {
                const modelNode = workflow[mappingsForModels.model.nodeId];
                const inputKey = getModelInputKey(modelNode);
                console.log(`[ComfyUI] ✅ 模型替换: 节点${mappingsForModels.model.nodeId} [${modelNode.class_type}].${inputKey} <- ${dp.model}`);
                modelNode.inputs[inputKey] = dp.model;
            } else {
                console.log(`[ComfyUI] ⏭ 模型替换跳过: nodeId=${mappingsForModels.model?.nodeId}, dp.model=${dp.model || '(空)'}`);
            }

            // CLIP 节点替换（从 class_type 判断 inputKey）
            if (mappingsForModels.clip?.nodeId && workflow[mappingsForModels.clip.nodeId] && dp.clip) {
                const clipNode = workflow[mappingsForModels.clip.nodeId];
                const clipKey = getClipInputKey(clipNode);
                clipNode.inputs[clipKey] = dp.clip;
                console.log(`[ComfyUI] ✅ CLIP替换: 节点${mappingsForModels.clip.nodeId} [${clipNode.class_type}].${clipKey} <- ${dp.clip}`);
            }

            // VAE 节点替换
            if (mappingsForModels.vae?.nodeId && workflow[mappingsForModels.vae.nodeId] && dp.vae) {
                const vaeNode = workflow[mappingsForModels.vae.nodeId];
                vaeNode.inputs['vae_name'] = dp.vae;
                console.log(`[ComfyUI] ✅ VAE替换: 节点${mappingsForModels.vae.nodeId}.vae_name <- ${dp.vae}`);
            }

            const comfyPrompt = {
                prompt: workflow,
                client_id: 'sd-helper-' + Date.now()
            };
            const response = await this._stApiFetch('/api/sd/comfy/generate', {
                url: url,
                prompt: JSON.stringify(comfyPrompt)
            });

            if (!response.ok) {
                const errText = await response.text();
                return { success: false, error: `生成失败 (${response.status}): ${errText}` };
            }

            const result = await response.json();
            if (result.data) {
                return { success: true, base64: result.data, format: result.format || 'png' };
            }
            return { success: false, error: 'SillyTavern 未返回图片数据' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    // ============ 配置相关 ============

    getDefaultConfig() {
        return {
            serverUrl: 'http://127.0.0.1:8188',
            workflowJson: JSON.stringify(DEFAULT_WORKFLOW, null, 2), // 默认填入
            savedWorkflows: {
                'Default T2I': JSON.stringify(DEFAULT_WORKFLOW, null, 2)
            },
            currentWorkflow: 'Default T2I',
            testPrompt: '1girl, masterpiece, best quality',
            parameterMappings: { prompt: null, negative: null, sampler: null, size: null, model: null, clipSkip: null, clip: null, vae: null },
            defaultParams: {
                steps: 20, cfg: 7, seed: -1, width: 1024, height: 1024, denoise: 1.0,
                sampler: 'euler', scheduler: 'normal', clipSkip: -2, model: '',
                clip: '', vae: '',
                loras: []
            },
            // 缓存获取到的资源列表，保存后持久化
            cachedResources: {
                models: [],      // [{value, text}]
                samplers: [],    // [string]
                schedulers: [],  // [string]
                loras: [],       // [{value, text}]
                clips: [],       // [{value, text}]
                vaes: []         // [{value, text}]
            }
        };
    },

    getConfigFields() {
        return [
            { key: 'serverUrl', label: '服务器地址', type: 'text', placeholder: 'http://127.0.0.1:8188' },
            { key: 'workflowJson', label: 'Workflow JSON', type: 'textarea' }
        ];
    },

    renderConfigUI(config) {
        const c = { ...this.getDefaultConfig(), ...config };
        const dp = c.defaultParams || {};
        const loras = dp.loras || [];

        // 从缓存获取资源列表
        const cachedResources = c.cachedResources || {};
        const cachedModels = cachedResources.models || [];
        const cachedSamplers = cachedResources.samplers || [];
        const cachedSchedulers = cachedResources.schedulers || [];
        const cachedLoras = cachedResources.loras || [];
        const cachedClips = cachedResources.clips || [];
        const cachedVaes = cachedResources.vaes || [];

        // 生成模型下拉列表 HTML
        let modelOptionsHtml = '<option value="">-- 使用 Workflow 默认 --</option>';
        if (cachedModels.length > 0) {
            cachedModels.forEach(m => {
                const val = m.value || m;
                const txt = m.text || val.split('/').pop().split('\\').pop();
                const isSelected = val === dp.model ? 'selected' : '';
                modelOptionsHtml += `<option value="${val}" ${isSelected}>${txt}</option>`;
            });
        } else if (dp.model) {
            // 没有缓存时显示当前选中的
            modelOptionsHtml += `<option value="${dp.model}" selected>${dp.model.split('/').pop().split('\\').pop()}</option>`;
        }

        // 生成采样器下拉列表 HTML
        let samplerOptionsHtml = '';
        if (cachedSamplers.length > 0) {
            cachedSamplers.forEach(s => {
                const isSelected = s === dp.sampler ? 'selected' : '';
                samplerOptionsHtml += `<option value="${s}" ${isSelected}>${s}</option>`;
            });
        } else {
            samplerOptionsHtml = `<option value="${dp.sampler || 'euler'}">${dp.sampler || 'euler'}</option>`;
        }

        // 生成调度器下拉列表 HTML
        let schedulerOptionsHtml = '';
        if (cachedSchedulers.length > 0) {
            cachedSchedulers.forEach(s => {
                const isSelected = s === dp.scheduler ? 'selected' : '';
                schedulerOptionsHtml += `<option value="${s}" ${isSelected}>${s}</option>`;
            });
        } else {
            schedulerOptionsHtml = `<option value="${dp.scheduler || 'normal'}">${dp.scheduler || 'normal'}</option>`;
        }

        // 生成 LoRA datalist (用于下拉提示)
        let loraDatalistHtml = '';
        cachedLoras.forEach(l => {
            loraDatalistHtml += `<option value="${l.value || l}">${l.text || l}</option>`;
        });

        // 生成 CLIP 下拉列表 HTML
        let clipOptionsHtml = '<option value="">-- 使用 Workflow 默认 --</option>';
        if (cachedClips.length > 0) {
            cachedClips.forEach(clipItem => {
                const val = clipItem.value || clipItem;
                const txt = clipItem.text || val.split('/').pop().split('\\').pop();
                const isSelected = val === dp.clip ? 'selected' : '';
                clipOptionsHtml += `<option value="${val}" ${isSelected}>${txt}</option>`;
            });
        } else if (dp.clip) {
            clipOptionsHtml += `<option value="${dp.clip}" selected>${dp.clip.split('/').pop().split('\\').pop()}</option>`;
        }

        // 生成 VAE 下拉列表 HTML
        let vaeOptionsHtml = '<option value="">-- 使用 Workflow 默认 --</option>';
        if (cachedVaes.length > 0) {
            cachedVaes.forEach(v => {
                const val = v.value || v;
                const txt = v.text || val.split('/').pop().split('\\').pop();
                const isSelected = val === dp.vae ? 'selected' : '';
                vaeOptionsHtml += `<option value="${val}" ${isSelected}>${txt}</option>`;
            });
        } else if (dp.vae) {
            vaeOptionsHtml += `<option value="${dp.vae}" selected>${dp.vae.split('/').pop().split('\\').pop()}</option>`;
        }

        // 生成 LoRA 行 HTML（添加勾选框和 datalist）
        let lorasHtml = '';
        for (let i = 0; i < loras.length && i < 5; i++) {
            const lora = loras[i];
            const isEnabled = lora.enabled !== false; // 默认启用
            lorasHtml += `
                <div class="sd-lora-row" data-index="${i}" style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                    <input type="checkbox" class="sd-lora-enabled" ${isEnabled ? 'checked' : ''} style="margin:0 4px;" title="是否启用">
                    <input type="text" class="sd-lora-name text_pole" list="sd-comfyui-lora-datalist" value="${lora.name || ''}" placeholder="LoRA 文件名 (可下拉选择或手动输入)" style="flex:2; font-size:0.85em;">
                    <input type="number" class="sd-lora-model text_pole" value="${lora.modelStrength ?? 1}" step="0.1" min="0" max="2" style="width:60px;" title="模型强度">
                    <input type="number" class="sd-lora-clip text_pole" value="${lora.clipStrength ?? 1}" step="0.1" min="0" max="2" style="width:60px;" title="CLIP强度">
                    <button class="sd-lora-remove" style="background:none; border:none; color:#f66; cursor:pointer; padding:2px 6px;">✕</button>
                </div>`;
        }

        // 生成已保存的工作流选项
        const savedWorkflows = c.savedWorkflows || {};
        const workflowNames = Object.keys(savedWorkflows);
        let workflowOptionsHtml = '<option value="">-- 新建工作流 --</option>';
        workflowNames.forEach(name => {
            const isSelected = c.currentWorkflow === name ? 'selected' : '';
            workflowOptionsHtml += `<option value="${name}" ${isSelected}>${name}</option>`;
        });

        // 获取预设列表（从全局 settings）
        const presets = window.SD_SETTINGS?.promptPresets || { 'Default': { prefix: '', suffix: '', negative: '' } };
        const presetOptions = Object.keys(presets).map(name =>
            `<option value="${name}" ${name === c.selectedPreset ? 'selected' : ''}>${name}</option>`
        ).join('');

        // 生成默认工作流预设选项
        const defaultWorkflows = window.SD_DEFAULT_IMAGE_WORKFLOWS || {};
        const defaultWorkflowOptions = Object.keys(defaultWorkflows).map(name =>
            `<option value="${name}">${name}</option>`
        ).join('');

        return `
            <div class="sd-connector-config" data-connector="comfyui">
                <!-- 前后缀预设选择 -->
                <div style="margin-bottom:12px; padding:10px; background:rgba(0,0,0,0.15); border-radius:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size:0.9em; color:#aaa; white-space:nowrap;">📝 前后缀预设:</label>
                        <select id="sd-comfyui-preset-select" class="text_pole" style="flex:1; font-size:0.9em;">
                            ${presetOptions}
                        </select>
                        <button id="sd-comfyui-preset-edit" class="sd-btn-secondary" title="编辑预设" style="padding:4px 8px; font-size:0.85em;">✏️</button>
                    </div>
                </div>

                <!-- 服务器地址 + 获取模型按钮（同一行） -->
                <div style="display:flex; gap:8px; margin-bottom:12px;">
                    <input type="text" id="sd-comfyui-url" class="text_pole" style="flex:1;"
                           placeholder="http://127.0.0.1:8188" value="${c.serverUrl || ''}">
                    <button id="sd-comfyui-test" class="sd-btn-secondary" style="white-space:nowrap;">📥 获取模型</button>
                </div>

                <!-- 工作流选择器 -->
                <div style="margin-bottom:12px;">
                    <small style="color:#888;">工作流</small>
                    <div style="display:flex; gap:6px;">
                        <select id="sd-comfyui-workflow-select" class="text_pole" style="flex:1;">
                            ${workflowOptionsHtml}
                        </select>
                        <button id="sd-comfyui-save-workflow" class="sd-btn-secondary" style="padding:0 10px;" title="保存当前工作流">💾</button>
                        <button id="sd-comfyui-delete-workflow" class="sd-btn-secondary" style="padding:0 10px; color:#f66;" title="删除选中工作流">🗑</button>
                    </div>
                    <!-- 默认模板选择器 -->
                    <div style="display:flex; gap:6px; margin-top:6px;">
                        <select id="sd-comfyui-default-workflow" class="text_pole" style="flex:1;">
                            <option value="">-- 从默认模板加载 --</option>
                            ${defaultWorkflowOptions}
                        </select>
                        <button id="sd-comfyui-load-default" class="sd-btn-secondary" style="padding:0 12px;" title="加载选中的默认模板">📥 加载</button>
                    </div>
                </div>
                
                <!-- Workflow JSON -->
                <div style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <small style="color:#888;">Workflow JSON</small>
                        <div style="display:flex; gap:4px;">
                            <button id="sd-comfyui-reset" class="sd-btn-secondary" style="font-size:0.8em; padding:2px 8px;" title="重置为默认工作流">🔄 默认</button>
                            <button id="sd-comfyui-upload" class="sd-btn-secondary" style="font-size:0.8em; padding:2px 8px;">📂 上传</button>
                            <button id="sd-comfyui-paste" class="sd-btn-secondary" style="font-size:0.8em; padding:2px 8px;">📋 粘贴</button>
                        </div>
                    </div>
                    <textarea id="sd-comfyui-workflow" class="text_pole" rows="4" 
                              style="font-family:monospace; font-size:0.8em;"
                              placeholder="粘贴从 ComfyUI 导出的 API 格式 JSON...">${c.workflowJson || ''}</textarea>
                    <div style="display:flex; gap:6px; margin-top:6px;">
                        <button id="sd-comfyui-detect" class="sd-btn-secondary" style="flex:1; font-size:0.85em;">🔍 自动检测节点</button>
                        <button id="sd-comfyui-toggle-vars" class="sd-btn-secondary" style="flex:1; font-size:0.85em;">📝 变量替换</button>
                    </div>
                </div>

                <!-- 变量面板（默认隐藏） -->
                <div id="sd-comfyui-vars-panel" style="display:none; margin-bottom:12px; padding:10px; background:rgba(108,140,255,0.1); border-radius:6px; border:1px solid rgba(108,140,255,0.3);">
                    <small style="color:#888; display:block; margin-bottom:8px;">💡 点击变量复制，在JSON中替换对应值。文本用引号，数值直接替换。</small>
                    <div style="display:flex; flex-wrap:wrap; gap:4px;">
                        <button class="sd-var-btn" data-var="%prompt%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#6c8cff; cursor:pointer; font-size:0.75em;">%prompt%</button>
                        <button class="sd-var-btn" data-var="%negative%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#6c8cff; cursor:pointer; font-size:0.75em;">%negative%</button>
                        <button class="sd-var-btn" data-var="%seed%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#6c8cff; cursor:pointer; font-size:0.75em;">%seed%</button>
                        <button class="sd-var-btn" data-var="%steps%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#6c8cff; cursor:pointer; font-size:0.75em;">%steps%</button>
                        <button class="sd-var-btn" data-var="%cfg%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#6c8cff; cursor:pointer; font-size:0.75em;">%cfg%</button>
                        <button class="sd-var-btn" data-var="%width%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#6c8cff; cursor:pointer; font-size:0.75em;">%width%</button>
                        <button class="sd-var-btn" data-var="%height%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#6c8cff; cursor:pointer; font-size:0.75em;">%height%</button>
                        <button class="sd-var-btn" data-var="%denoise%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#6c8cff; cursor:pointer; font-size:0.75em;">%denoise%</button>
                        <button class="sd-var-btn" data-var="%sampler%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#4ade80; cursor:pointer; font-size:0.75em;">%sampler%</button>
                        <button class="sd-var-btn" data-var="%scheduler%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#4ade80; cursor:pointer; font-size:0.75em;">%scheduler%</button>
                        <button class="sd-var-btn" data-var="%clip_skip%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#4ade80; cursor:pointer; font-size:0.75em;">%clip_skip%</button>
                        <button class="sd-var-btn" data-var="%model%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#4ade80; cursor:pointer; font-size:0.75em;">%model%</button>
                        <button class="sd-var-btn" data-var="%lora1%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#f9a8d4; cursor:pointer; font-size:0.75em;">%lora1%</button>
                        <button class="sd-var-btn" data-var="%lora1_strength%" style="padding:4px 8px; background:#2a2a35; border:none; border-radius:4px; color:#f9a8d4; cursor:pointer; font-size:0.75em;">%lora1_strength%</button>
                    </div>
                    <div id="sd-comfyui-vars-detected" style="margin-top:8px; font-size:0.8em;"></div>
                </div>

                <!-- 节点映射（可折叠） -->
                <details style="margin-bottom:12px;">
                    <summary style="cursor:pointer; color:#888; font-size:0.9em; padding:6px 0;">▸ 节点映射<br><small>（点击左上自动检测，生图时自动替换参数。仅适用简单工作流，复杂工作流请手填变量）</small></summary>
                    <div style="padding:10px; background:rgba(0,0,0,0.2); border-radius:6px; margin-top:6px;">
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                            <div>
                                <small style="color:#666;">正向节点ID</small>
                                <input type="text" id="sd-comfyui-prompt-node" class="text_pole" 
                                       value="${c.parameterMappings?.prompt?.nodeId || ''}" placeholder="如: 6">
                            </div>
                            <div>
                                <small style="color:#666;">负向节点ID</small>
                                <input type="text" id="sd-comfyui-negative-node" class="text_pole" 
                                       value="${c.parameterMappings?.negative?.nodeId || ''}" placeholder="如: 7">
                            </div>
                            <div>
                                <small style="color:#666;">采样器节点ID</small>
                                <input type="text" id="sd-comfyui-sampler-node" class="text_pole" 
                                       value="${c.parameterMappings?.sampler?.nodeId || ''}" placeholder="如: 3">
                            </div>
                            <div>
                                <small style="color:#666;">尺寸节点ID</small>
                                <input type="text" id="sd-comfyui-size-node" class="text_pole" 
                                       value="${c.parameterMappings?.size?.nodeId || ''}" placeholder="如: 5">
                            </div>
                            <div>
                                <small style="color:#666;">模型节点ID</small>
                                <input type="text" id="sd-comfyui-model-node" class="text_pole" 
                                       value="${c.parameterMappings?.model?.nodeId || ''}" 
                                       data-input-key="${c.parameterMappings?.model?.inputKey || 'ckpt_name'}"
                                       placeholder="CheckpointLoader">
                            </div>
                            <div>
                                <small style="color:#666;">CLIP Skip节点ID</small>
                                <input type="text" id="sd-comfyui-clipskip-node" class="text_pole" 
                                       value="${c.parameterMappings?.clipSkip?.nodeId || ''}" placeholder="CLIPSetLastLayer">
                            </div>
                            <div>
                                <small style="color:#666;">CLIP加载器节点ID</small>
                                <input type="text" id="sd-comfyui-clip-node" class="text_pole" 
                                       value="${c.parameterMappings?.clip?.nodeId || ''}" 
                                       data-input-key="${c.parameterMappings?.clip?.inputKey || 'clip_name'}"
                                       placeholder="CLIPLoader">
                            </div>
                            <div>
                                <small style="color:#666;">VAE加载器节点ID</small>
                                <input type="text" id="sd-comfyui-vae-node" class="text_pole" 
                                       value="${c.parameterMappings?.vae?.nodeId || ''}" 
                                       data-input-key="${c.parameterMappings?.vae?.inputKey || 'vae_name'}"
                                       placeholder="VAELoader">
                            </div>
                        </div>
                        <!-- LoRA 节点映射 -->
                        <div style="margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                            <small style="color:#888; display:block; margin-bottom:6px;">LoRA 节点ID（最多5个）</small>
                            <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:4px;">
                                ${[0, 1, 2, 3, 4].map(i => `
                                    <input type="text" id="sd-comfyui-lora-node-${i}" class="text_pole sd-lora-node-input" 
                                           value="${c.parameterMappings?.loras?.[i]?.nodeId || ''}" 
                                           placeholder="LoRA${i + 1}" style="font-size:0.8em;">
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </details>
                
                <!-- 生成参数 -->
                <div style="padding:10px; background:rgba(0,0,0,0.2); border-radius:6px; margin-bottom:12px;">
                    <small style="color:#888; display:block; margin-bottom:8px;">生成参数</small>
                    
                    <!-- 模型选择（单独一行） -->
                    <div style="margin-bottom:10px;">
                        <small style="color:#666; font-size:0.75em;">模型 ${cachedModels.length > 0 ? '<span style="color:#4ade80;">(已缓存' + cachedModels.length + '个)</span>' : ''}</small>
                        <select id="sd-comfyui-model" class="text_pole" style="width:100%;">
                            ${modelOptionsHtml}
                        </select>
                    </div>

                    <!-- CLIP 模型选择 -->
                    <div style="margin-bottom:10px;">
                        <small style="color:#666; font-size:0.75em;">CLIP 模型 ${cachedClips.length > 0 ? '<span style="color:#4ade80;">(已缓存' + cachedClips.length + '个)</span>' : ''}</small>
                        <select id="sd-comfyui-clip" class="text_pole" style="width:100%;">
                            ${clipOptionsHtml}
                        </select>
                    </div>

                    <!-- VAE 模型选择 -->
                    <div style="margin-bottom:10px;">
                        <small style="color:#666; font-size:0.75em;">VAE ${cachedVaes.length > 0 ? '<span style="color:#4ade80;">(已缓存' + cachedVaes.length + '个)</span>' : ''}</small>
                        <select id="sd-comfyui-vae" class="text_pole" style="width:100%;">
                            ${vaeOptionsHtml}
                        </select>
                    </div>
                    
                    <!-- 分辨率预设（单独一行） -->
                    <div style="margin-bottom:10px;">
                        <small style="color:#666; font-size:0.75em;">分辨率预设</small>
                        <select id="sd-comfyui-resolution" class="text_pole" style="width:100%;">
                            <option value="">-- 自定义 (使用下方宽高) --</option>
                            <optgroup label="1:1 方形">
                                <option value="512x512" ${dp.width === 512 && dp.height === 512 ? 'selected' : ''}>512x512</option>
                                <option value="768x768" ${dp.width === 768 && dp.height === 768 ? 'selected' : ''}>768x768</option>
                                <option value="1024x1024" ${dp.width === 1024 && dp.height === 1024 ? 'selected' : ''}>1024x1024 (推荐)</option>
                                <option value="1280x1280" ${dp.width === 1280 && dp.height === 1280 ? 'selected' : ''}>1280x1280</option>
                            </optgroup>
                            <optgroup label="2:3 竖屏">
                                <option value="512x768" ${dp.width === 512 && dp.height === 768 ? 'selected' : ''}>512x768</option>
                                <option value="640x960" ${dp.width === 640 && dp.height === 960 ? 'selected' : ''}>640x960</option>
                                <option value="768x1152" ${dp.width === 768 && dp.height === 1152 ? 'selected' : ''}>768x1152</option>
                                <option value="832x1216" ${dp.width === 832 && dp.height === 1216 ? 'selected' : ''}>832x1216 (NAI)</option>
                                <option value="864x1296" ${dp.width === 864 && dp.height === 1296 ? 'selected' : ''}>864x1296</option>
                            </optgroup>
                            <optgroup label="3:4 竖屏">
                                <option value="768x1024" ${dp.width === 768 && dp.height === 1024 ? 'selected' : ''}>768x1024</option>
                                <option value="896x1152" ${dp.width === 896 && dp.height === 1152 ? 'selected' : ''}>896x1152</option>
                                <option value="960x1280" ${dp.width === 960 && dp.height === 1280 ? 'selected' : ''}>960x1280</option>
                            </optgroup>
                            <optgroup label="9:16 竖屏">
                                <option value="576x1024" ${dp.width === 576 && dp.height === 1024 ? 'selected' : ''}>576x1024</option>
                                <option value="720x1280" ${dp.width === 720 && dp.height === 1280 ? 'selected' : ''}>720x1280</option>
                            </optgroup>
                            <optgroup label="3:2 横屏">
                                <option value="768x512" ${dp.width === 768 && dp.height === 512 ? 'selected' : ''}>768x512</option>
                                <option value="960x640" ${dp.width === 960 && dp.height === 640 ? 'selected' : ''}>960x640</option>
                                <option value="1216x832" ${dp.width === 1216 && dp.height === 832 ? 'selected' : ''}>1216x832 (NAI)</option>
                            </optgroup>
                            <optgroup label="4:3 横屏">
                                <option value="1024x768" ${dp.width === 1024 && dp.height === 768 ? 'selected' : ''}>1024x768</option>
                                <option value="1280x960" ${dp.width === 1280 && dp.height === 960 ? 'selected' : ''}>1280x960</option>
                            </optgroup>
                            <optgroup label="16:9 横屏">
                                <option value="1024x576" ${dp.width === 1024 && dp.height === 576 ? 'selected' : ''}>1024x576</option>
                                <option value="1280x720" ${dp.width === 1280 && dp.height === 720 ? 'selected' : ''}>1280x720 (HD)</option>
                                <option value="1920x1080" ${dp.width === 1920 && dp.height === 1080 ? 'selected' : ''}>1920x1080 (FHD)</option>
                            </optgroup>
                        </select>
                    </div>
                    
                    <!-- 采样器 + 调度器（一行两列） -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
                        <div>
                            <small style="color:#666; font-size:0.75em;">采样方法 ${cachedSamplers.length > 0 ? '<span style="color:#4ade80;">(' + cachedSamplers.length + ')</span>' : ''}</small>
                            <select id="sd-comfyui-sampler" class="text_pole" style="font-size:0.85em;">
                                ${samplerOptionsHtml}
                            </select>
                        </div>
                        <div>
                            <small style="color:#666; font-size:0.75em;">调度器 ${cachedSchedulers.length > 0 ? '<span style="color:#4ade80;">(' + cachedSchedulers.length + ')</span>' : ''}</small>
                            <select id="sd-comfyui-scheduler" class="text_pole" style="font-size:0.85em;">
                                ${schedulerOptionsHtml}
                            </select>
                        </div>
                    </div>
                    
                    <!-- 步数 + CFG + 种子 + 去噪（一行四列） -->
                    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:8px;">
                        <div>
                            <small style="color:#666; font-size:0.75em;">步数</small>
                            <input type="number" id="sd-comfyui-steps" class="text_pole" value="${dp.steps || 20}" min="1" max="150" style="font-size:0.85em;">
                        </div>
                        <div>
                            <small style="color:#666; font-size:0.75em;">CFG</small>
                            <input type="number" id="sd-comfyui-cfg" class="text_pole" value="${dp.cfg || 7}" min="1" max="30" step="0.5" style="font-size:0.85em;">
                        </div>
                        <div>
                            <small style="color:#666; font-size:0.75em;">种子</small>
                            <input type="number" id="sd-comfyui-seed" class="text_pole" value="${dp.seed || -1}" style="font-size:0.85em;">
                        </div>
                        <div>
                            <small style="color:#666; font-size:0.75em;">去噪</small>
                            <input type="number" id="sd-comfyui-denoise" class="text_pole" value="${dp.denoise || 1.0}" min="0" max="1" step="0.05" style="font-size:0.85em;">
                        </div>
                    </div>
                    
                    <!-- 宽度 + 高度 + 跳层（一行三列，作为自定义微调） -->
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                        <div>
                            <small style="color:#666; font-size:0.75em;">宽度</small>
                            <input type="number" id="sd-comfyui-width" class="text_pole" value="${dp.width || 512}" min="64" max="2048" step="64" style="font-size:0.85em;">
                        </div>
                        <div>
                            <small style="color:#666; font-size:0.75em;">高度</small>
                            <input type="number" id="sd-comfyui-height" class="text_pole" value="${dp.height || 768}" min="64" max="2048" step="64" style="font-size:0.85em;">
                        </div>
                        <div>
                            <small style="color:#666; font-size:0.75em;">跳层</small>
                            <input type="number" id="sd-comfyui-clipskip" class="text_pole" value="${dp.clipSkip || 1}" min="1" max="12" style="font-size:0.85em;">
                        </div>
                    </div>
                </div>

                <!-- LoRA datalist for autocomplete -->
                <datalist id="sd-comfyui-lora-datalist">
                    ${loraDatalistHtml}
                </datalist>

                <!-- LoRA 设置（可折叠） -->
                <details style="margin-bottom:8px;">
                    <summary style="cursor:pointer; color:#888; font-size:0.9em; padding:6px 0;">▸ LoRA 设置 (${loras.length}/5) ${cachedLoras.length > 0 ? '<span style="color:#4ade80; font-size:0.8em;">✓ 有' + cachedLoras.length + '个可选</span>' : ''}</summary>
                    <div id="sd-comfyui-loras-container" style="padding:10px; background:rgba(0,0,0,0.2); border-radius:6px; margin-top:6px;">
                        ${lorasHtml || '<div style="color:#666; font-size:0.85em;">暂无 LoRA，点击下方按钮添加</div>'}
                        <button id="sd-comfyui-add-lora" class="sd-btn-secondary" style="width:100%; margin-top:8px; font-size:0.85em;" ${loras.length >= 5 ? 'disabled' : ''}>+ 添加 LoRA</button>
                    </div>
                </details>

                <!-- 测试生图区域 -->
                <div style="margin-top:10px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
                    <label style="display:block; margin-bottom:8px; font-weight:600;">🖼️ 测试生图</label>
                    <div style="display:flex; gap:8px; margin-bottom:10px;">
                        <input type="text" id="sd-comfyui-test-prompt" class="text_pole" 
                               placeholder="输入测试提示词，如: 1girl, smile" 
                               style="flex:1;" value="${c.testPrompt || '1girl, masterpiece, best quality'}">
                        <button id="sd-comfyui-test-gen" class="sd-btn-primary" style="white-space:nowrap;">🎨 生成</button>
                    </div>
                    <div id="sd-comfyui-test-result" style="text-align:center; min-height:150px; background:rgba(0,0,0,0.1); border-radius:6px; padding:10px; display:flex; align-items:center; justify-content:center;">
                        <span style="color:#888;">点击"生成"按钮测试当前 Workflow</span>
                    </div>
                </div>
            </div>`;
    },

    parseConfigFromUI(existingConfig = {}) {
        // 解析 LoRA 设置（包含启用状态）
        const loras = [];
        $('.sd-lora-row').each(function () {
            const name = $(this).find('.sd-lora-name').val();
            if (name && name.trim()) {
                loras.push({
                    name: name.trim(),
                    enabled: $(this).find('.sd-lora-enabled').is(':checked'),
                    modelStrength: parseFloat($(this).find('.sd-lora-model').val()) || 1,
                    clipStrength: parseFloat($(this).find('.sd-lora-clip').val()) || 1
                });
            }
        });

        return {
            selectedPreset: $('#sd-comfyui-preset-select').val() || 'Default',
            serverUrl: $('#sd-comfyui-url').val() || 'http://127.0.0.1:8188',
            workflowJson: $('#sd-comfyui-workflow').val() || '',
            currentWorkflow: $('#sd-comfyui-workflow-select').val() || '',
            savedWorkflows: existingConfig.savedWorkflows || {},  // 保留已存在的工作流
            cachedResources: existingConfig.cachedResources || { models: [], samplers: [], schedulers: [], loras: [], clips: [], vaes: [] },  // 保留缓存资源
            testPrompt: $('#sd-comfyui-test-prompt').val() || '1girl, masterpiece, best quality',
            parameterMappings: {
                prompt: { nodeId: $('#sd-comfyui-prompt-node').val(), inputKey: 'text' },
                negative: { nodeId: $('#sd-comfyui-negative-node').val(), inputKey: 'text' },
                sampler: { nodeId: $('#sd-comfyui-sampler-node').val() },
                size: { nodeId: $('#sd-comfyui-size-node').val() },
                model: { nodeId: $('#sd-comfyui-model-node').val(), inputKey: $('#sd-comfyui-model-node').attr('data-input-key') || 'ckpt_name' },
                clipSkip: { nodeId: $('#sd-comfyui-clipskip-node').val(), inputKey: 'stop_at_clip_layer' },
                clip: { nodeId: $('#sd-comfyui-clip-node').val(), inputKey: $('#sd-comfyui-clip-node').attr('data-input-key') || 'clip_name' },
                vae: { nodeId: $('#sd-comfyui-vae-node').val(), inputKey: $('#sd-comfyui-vae-node').attr('data-input-key') || 'vae_name' },
                loras: [0, 1, 2, 3, 4].map(i => ({
                    nodeId: $(`#sd-comfyui-lora-node-${i}`).val() || '',
                    nameKey: 'lora_name',
                    modelStrengthKey: 'strength_model',
                    clipStrengthKey: 'strength_clip'
                })).filter(l => l.nodeId)
            },
            defaultParams: {
                steps: parseInt($('#sd-comfyui-steps').val()) || 20,
                cfg: parseFloat($('#sd-comfyui-cfg').val()) || 7,
                seed: parseInt($('#sd-comfyui-seed').val()) || -1,
                width: parseInt($('#sd-comfyui-width').val()) || 512,
                height: parseInt($('#sd-comfyui-height').val()) || 768,
                denoise: parseFloat($('#sd-comfyui-denoise').val()) || 1.0,
                sampler: $('#sd-comfyui-sampler').val() || 'euler',
                scheduler: $('#sd-comfyui-scheduler').val() || 'normal',
                clipSkip: parseInt($('#sd-comfyui-clipskip').val()) || 1,
                model: $('#sd-comfyui-model').val() || '',
                clip: $('#sd-comfyui-clip').val() || '',
                vae: $('#sd-comfyui-vae').val() || '',
                loras: loras
            }
        };
    },

    /**
     * 自动检测 workflow 中的节点
     */
    autoDetectNodes(workflowJson) {
        try {
            const workflow = JSON.parse(workflowJson);
            const detected = {
                prompt: null,
                negative: null,
                sampler: null,
                size: null,
                model: null,      // CheckpointLoaderSimple / UNETLoader
                clipSkip: null,   // CLIPSetLastLayer
                clip: null,       // CLIPLoader
                vae: null,        // VAELoader
                loras: []         // LoraLoader 节点列表
            };

            // 1. 检测 KSampler 节点
            let samplerNodeId = null;
            for (const nodeId in workflow) {
                const node = workflow[nodeId];
                const classType = node.class_type?.toLowerCase() || '';

                if (classType.includes('ksampler') || classType === 'sampler') {
                    samplerNodeId = nodeId;
                    detected.sampler = { nodeId };
                    break;
                }
            }

            // 2. 通过 KSampler 的连接检测正向/负向提示词节点
            if (samplerNodeId && workflow[samplerNodeId]) {
                const samplerInputs = workflow[samplerNodeId].inputs;

                if (samplerInputs.positive && Array.isArray(samplerInputs.positive)) {
                    const positiveNodeId = String(samplerInputs.positive[0]);
                    detected.prompt = { nodeId: positiveNodeId, inputKey: 'text' };
                }

                if (samplerInputs.negative && Array.isArray(samplerInputs.negative)) {
                    const negativeNodeId = String(samplerInputs.negative[0]);
                    detected.negative = { nodeId: negativeNodeId, inputKey: 'text' };
                }
            }

            // 3. 回退：按顺序查找 CLIPTextEncode 节点
            if (!detected.prompt || !detected.negative) {
                for (const nodeId in workflow) {
                    const node = workflow[nodeId];
                    const classType = node.class_type?.toLowerCase() || '';

                    if (classType.includes('cliptextencode')) {
                        if (!detected.prompt) {
                            detected.prompt = { nodeId, inputKey: 'text' };
                        } else if (!detected.negative) {
                            detected.negative = { nodeId, inputKey: 'text' };
                        }
                    }
                }
            }

            // 4. 检测其他节点类型
            for (const nodeId in workflow) {
                const node = workflow[nodeId];
                const classType = node.class_type?.toLowerCase() || '';
                const originalClassType = node.class_type || '';

                // 尺寸节点
                if (!detected.size && (classType.includes('emptylatentimage') || classType.includes('empty_latent'))) {
                    detected.size = { nodeId };
                }

                // 模型加载器节点（区分 Checkpoint 和 UNET）
                if (!detected.model) {
                    if (classType.includes('unetloader') || originalClassType === 'UNETLoader') {
                        detected.model = { nodeId, inputKey: 'unet_name' };
                    } else if (classType.includes('checkpointloader') || classType === 'load_checkpoint') {
                        detected.model = { nodeId, inputKey: 'ckpt_name' };
                    }
                }

                // CLIP Skip 节点
                if (!detected.clipSkip && (classType.includes('clipsetlastlayer') || classType.includes('clip_skip'))) {
                    detected.clipSkip = { nodeId, inputKey: 'stop_at_clip_layer' };
                }

                // CLIP 加载器节点（独立的 CLIPLoader，不是 CLIPTextEncode）
                if (!detected.clip && (originalClassType === 'CLIPLoader' || originalClassType === 'DualCLIPLoader')) {
                    const clipKey = originalClassType === 'DualCLIPLoader' ? 'clip_name1' : 'clip_name';
                    detected.clip = { nodeId, inputKey: clipKey };
                }

                // VAE 加载器节点
                if (!detected.vae && (originalClassType === 'VAELoader' || classType === 'load_vae')) {
                    detected.vae = { nodeId, inputKey: 'vae_name' };
                }

                // LoRA 加载器节点
                if (classType.includes('loraloader') || classType === 'load_lora') {
                    const inputs = node.inputs || {};
                    detected.loras.push({
                        nodeId,
                        nameKey: 'lora_name',
                        modelStrengthKey: 'strength_model',
                        clipStrengthKey: 'strength_clip',
                        // 工作流中的实际值（用于回写到 UI）
                        name: inputs.lora_name || '',
                        modelStrength: inputs.strength_model ?? 1,
                        clipStrength: inputs.strength_clip ?? 1
                    });
                }
            }

            console.log('[ComfyUI] 检测到节点:', detected);
            return detected;
        } catch (e) {
            console.error('[ComfyUI] 节点检测失败:', e);
            return null;
        }
    },

    detectVariables(workflowJson) {
        const SUPPORTED_VARS = [
            '%prompt%', '%negative%', '%seed%', '%steps%', '%cfg%', '%width%', '%height%', '%denoise%',
            '%sampler%', '%scheduler%', '%clip_skip%', '%model%', '%clip%', '%vae%',
            '%lora1%', '%lora2%', '%lora3%', '%lora4%', '%lora5%'
        ];
        const detected = [];
        for (const v of SUPPORTED_VARS) {
            if (workflowJson && workflowJson.includes(v)) {
                detected.push(v);
            }
        }
        return detected;
    },

    /**
     * 填充资源下拉框
     */
    populateResourceSelects(resources) {
        // 模型
        const modelSelect = $('#sd-comfyui-model');
        const currentModel = modelSelect.val();
        modelSelect.find('option:not(:first)').remove();
        resources.models?.forEach(m => {
            modelSelect.append(`<option value="${m.value}">${m.text}</option>`);
        });
        if (currentModel) modelSelect.val(currentModel);

        // 采样器
        const samplerSelect = $('#sd-comfyui-sampler');
        const currentSampler = samplerSelect.val();
        samplerSelect.empty();
        resources.samplers?.forEach(s => {
            samplerSelect.append(`<option value="${s}">${s}</option>`);
        });
        if (currentSampler) samplerSelect.val(currentSampler);

        // 调度器
        const schedulerSelect = $('#sd-comfyui-scheduler');
        const currentScheduler = schedulerSelect.val();
        schedulerSelect.empty();
        resources.schedulers?.forEach(s => {
            schedulerSelect.append(`<option value="${s}">${s}</option>`);
        });
        if (currentScheduler) schedulerSelect.val(currentScheduler);

        // LoRA（更新所有 LoRA 下拉框）
        $('.sd-lora-select').each(function () {
            const current = $(this).val();
            $(this).find('option:not(:first)').remove();
            resources.loras?.forEach(l => {
                $(this).append(`<option value="${l.value}">${l.text}</option>`);
            });
            if (current) $(this).val(current);
        });

        // CLIP
        const clipSelect = $('#sd-comfyui-clip');
        const currentClip = clipSelect.val();
        clipSelect.find('option:not(:first)').remove();
        resources.clips?.forEach(c => {
            clipSelect.append(`<option value="${c.value}">${c.text}</option>`);
        });
        if (currentClip) clipSelect.val(currentClip);

        // VAE
        const vaeSelect = $('#sd-comfyui-vae');
        const currentVae = vaeSelect.val();
        vaeSelect.find('option:not(:first)').remove();
        resources.vaes?.forEach(v => {
            vaeSelect.append(`<option value="${v.value}">${v.text}</option>`);
        });
        if (currentVae) vaeSelect.val(currentVae);
    }
};

// 注册连接器
if (typeof window !== 'undefined') {
    window.SD_CONNECTORS = window.SD_CONNECTORS || [];
    window.SD_CONNECTORS.push(ComfyUIConnector);
    window.SD_ComfyUIConnector = ComfyUIConnector;
}
