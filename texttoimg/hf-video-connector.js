/**
 * SD Helper - HuggingFace WAN 2.2 视频连接器
 * 使用 @gradio/client 官方库连接 HuggingFace Spaces
 * Space: r3gm/wan2-2-fp8da-aoti-preview2
 */

const HuggingFaceVideoConnector = {
    id: 'hf-video',
    name: 'HuggingFace 视频',
    description: '使用 HuggingFace WAN 2.2 在线服务生成视频（需要 HF Token）',
    icon: '🤗',

    // Space 信息
    SPACE_ID: 'r3gm/wan2-2-fp8da-aoti-preview2',

    // Gradio Client 是否已加载
    _gradioClientLoaded: false,
    _gradioClient: null,

    // 默认负面提示词（来自官方 Space）
    DEFAULT_NEGATIVE: '色调艳丽, 过曝, 静态, 细节模糊不清, 字幕, 风格, 作品, 画作, 画面, 静止, 整体发灰, 最差质量, 低质量, JPEG压缩残留, 丑陋的, 残缺的, 多余的手指, 画得不好的手部, 画得不好的脸部, 畸形的, 毁容的, 形态畸形的肢体, 手指融合, 静止不动的画面, 杂乱的背景, 三条腿, 背景人很多, 倒着走',

    // 调度器选项
    SCHEDULERS: [
        { value: 'UniPCMultistep', label: 'UniPCMultistep (推荐)' },
        { value: 'Euler', label: 'Euler' },
        { value: 'DDIM', label: 'DDIM' }
    ],

    // 帧率倍数选项
    FRAME_MULTIPLIERS: [
        { value: '1', label: '1x (标准)' },
        { value: '8', label: '8x' },
        { value: '16', label: '16x (流畅)' }
    ],

    // ============ Gradio Client 加载 ============

    /**
     * 动态加载 @gradio/client 库
     */
    async loadGradioClient() {
        if (this._gradioClientLoaded && window.GradioClient) {
            return window.GradioClient;
        }

        console.log('[HF Video] 加载 @gradio/client 库...');

        return new Promise((resolve, reject) => {
            // 使用 CDN 加载 @gradio/client
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";
                window.GradioClient = { Client, handle_file };
                window.dispatchEvent(new Event('gradio-client-loaded'));
            `;

            const handler = () => {
                window.removeEventListener('gradio-client-loaded', handler);
                this._gradioClientLoaded = true;
                console.log('[HF Video] @gradio/client 加载成功');
                resolve(window.GradioClient);
            };

            window.addEventListener('gradio-client-loaded', handler);

            script.onerror = () => {
                window.removeEventListener('gradio-client-loaded', handler);
                reject(new Error('加载 Gradio Client 失败'));
            };

            document.head.appendChild(script);

            // 超时处理
            setTimeout(() => {
                if (!this._gradioClientLoaded) {
                    window.removeEventListener('gradio-client-loaded', handler);
                    reject(new Error('加载 Gradio Client 超时'));
                }
            }, 10000);
        });
    },

    // ============ 核心方法 ============

    async testConnection(config) {
        const token = config.accessToken || '';
        if (!token) {
            return { success: false, message: '请先填写 HuggingFace API Token' };
        }

        try {
            // 检查 Token 是否有效
            const response = await fetch('https://huggingface.co/api/whoami-v2', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const user = await response.json();

                // 尝试加载 Gradio Client
                try {
                    await this.loadGradioClient();
                    return { success: true, message: `✅ Token 有效！用户: ${user.name || user.id}` };
                } catch (e) {
                    return { success: true, message: `⚠️ Token 有效，但 Gradio Client 加载失败: ${e.message}` };
                }
            } else if (response.status === 401) {
                return { success: false, message: '❌ Token 无效，请检查' };
            } else {
                return { success: false, message: `连接失败 (HTTP ${response.status})` };
            }
        } catch (e) {
            console.error('[HF Video] 连接测试失败:', e);
            return { success: false, message: `连接失败: ${e.message}` };
        }
    },

    /**
     * 生成视频
     * @param {string} prompt - 视频提示词
     * @param {string} imageBase64 - 源图片 base64
     * @param {Object} params - 生成参数
     * @param {Object} config - 连接器配置
     */
    async generate(prompt, imageBase64, params, config) {
        const token = config.accessToken || '';
        if (!token) {
            return { success: false, error: '请先配置 HuggingFace API Token' };
        }

        const dp = config.defaultParams || {};

        console.log('[HF Video] 开始生成视频 (WAN 2.2)');
        console.log('[HF Video] Space:', this.SPACE_ID);
        console.log('[HF Video] 提示词:', prompt);

        try {
            // 1. 加载 Gradio Client
            const { Client, handle_file } = await this.loadGradioClient();

            // 2. 连接到 Space
            console.log('[HF Video] 连接到 Space...');
            const client = await Client.connect(this.SPACE_ID, {
                hf_token: token
            });

            console.log('[HF Video] 连接成功，查看 API...');
            const apiInfo = await client.view_api();
            console.log('[HF Video] API 信息:', apiInfo);

            // 3. 将 base64 转换为 Blob
            const imageBlob = this.base64ToBlob(imageBase64, 'image/jpeg');

            // 4. 调用 generate_video API
            console.log('[HF Video] 开始调用 /generate_video...');

            const result = await client.predict("/generate_video", {
                input_image: handle_file(imageBlob),
                last_image: handle_file(imageBlob),
                prompt: prompt || '',
                steps: params.steps || dp.steps || 6,
                negative_prompt: dp.negativePrompt || this.DEFAULT_NEGATIVE,
                duration_seconds: params.duration || dp.duration || 3.5,
                guidance_scale: dp.guidanceScale || 1,
                guidance_scale_2: dp.guidanceScale2 || 1,
                seed: dp.seed || 42,
                randomize_seed: dp.randomizeSeed !== false,
                quality: dp.quality || 6,
                scheduler: dp.scheduler || 'UniPCMultistep',
                flow_shift: dp.flowShift || 3,
                frame_multiplier: dp.frameMultiplier || '16',
                video_component: true
            });

            console.log('[HF Video] API 返回结果:', result);

            // 5. 解析结果
            if (result && result.data) {
                const videoInfo = result.data[0];
                let videoUrl = '';

                if (typeof videoInfo === 'string') {
                    videoUrl = videoInfo;
                } else if (videoInfo && videoInfo.url) {
                    videoUrl = videoInfo.url;
                } else if (videoInfo && videoInfo.video && videoInfo.video.url) {
                    videoUrl = videoInfo.video.url;
                } else if (videoInfo && videoInfo.path) {
                    videoUrl = videoInfo.path;
                }

                if (videoUrl) {
                    console.log('[HF Video] 视频 URL:', videoUrl);

                    // 下载视频转为 base64
                    const videoResponse = await fetch(videoUrl, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!videoResponse.ok) {
                        // 尝试不带 token
                        const videoResponse2 = await fetch(videoUrl);
                        if (!videoResponse2.ok) {
                            return { success: false, error: '下载视频失败' };
                        }
                        const videoBlob = await videoResponse2.blob();
                        const videoBase64 = await this.blobToBase64(videoBlob);
                        return {
                            success: true,
                            base64: videoBase64,
                            format: 'mp4',
                            isVideo: true
                        };
                    }

                    const videoBlob = await videoResponse.blob();
                    const videoBase64 = await this.blobToBase64(videoBlob);

                    return {
                        success: true,
                        base64: videoBase64,
                        format: 'mp4',
                        isVideo: true
                    };
                }
            }

            return { success: false, error: '无法解析视频响应' };

        } catch (e) {
            console.error('[HF Video] 生成失败:', e);
            return { success: false, error: e.message || '生成失败' };
        }
    },

    // ============ 工具方法 ============

    base64ToBlob(base64, mimeType = 'image/jpeg') {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let i = 0; i < byteCharacters.length; i += 512) {
            const slice = byteCharacters.slice(i, i + 512);
            const byteNumbers = new Array(slice.length);
            for (let j = 0; j < slice.length; j++) {
                byteNumbers[j] = slice.charCodeAt(j);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }
        return new Blob(byteArrays, { type: mimeType });
    },

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },

    // ============ 配置相关 ============

    getDefaultConfig() {
        return {
            accessToken: '',
            defaultParams: {
                steps: 6,
                duration: 3.5,
                guidanceScale: 1,
                guidanceScale2: 1,
                seed: 42,
                randomizeSeed: true,
                quality: 6,
                scheduler: 'UniPCMultistep',
                flowShift: 3,
                frameMultiplier: '16',
                negativePrompt: ''
            }
        };
    },

    renderConfigUI(config) {
        const c = { ...this.getDefaultConfig(), ...config };
        const dp = c.defaultParams || {};

        // 调度器选项
        const schedulerHtml = this.SCHEDULERS.map(s =>
            `<option value="${s.value}" ${dp.scheduler === s.value ? 'selected' : ''}>${s.label}</option>`
        ).join('');

        // 帧率倍数选项
        const frameMultiplierHtml = this.FRAME_MULTIPLIERS.map(f =>
            `<option value="${f.value}" ${dp.frameMultiplier === f.value ? 'selected' : ''}>${f.label}</option>`
        ).join('');

        return `
            <div class="sd-connector-config" data-connector="hf-video">
                <!-- HuggingFace API Token -->
                <div style="margin-bottom:12px;">
                    <label style="display:block; margin-bottom:4px; font-size:0.85em; color:#aaa;">🔑 HuggingFace API Token</label>
                    <div style="display:flex; gap:8px;">
                        <input type="password" id="sd-hf-token" class="text_pole" style="flex:1;"
                               placeholder="hf_xxxxxxxxxx" value="${c.accessToken || ''}">
                        <button id="sd-hf-test" class="sd-btn-secondary" style="white-space:nowrap;">🧪 测试</button>
                    </div>
                    <small style="color:#888; display:block; margin-top:4px;">
                        在 <a href="https://huggingface.co/settings/tokens" target="_blank" style="color:#6cf;">huggingface.co/settings/tokens</a> 获取 Token（免费）
                    </small>
                </div>

                <!-- 提示信息 -->
                <div style="padding:10px; background:rgba(108,140,255,0.1); border-radius:6px; margin-bottom:12px; border-left:3px solid var(--nm-accent);">
                    <small style="color:var(--nm-accent);">
                        🎬 使用 WAN 2.2 14B FP8 模型 + @gradio/client 官方库<br>
                        💡 免费使用，可能需要排队。每次生成约 3.5 秒视频。
                    </small>
                </div>

                <!-- 基本参数 -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
                    <div>
                        <label style="font-size:0.8em; color:#888;">步数 (1-20)</label>
                        <input type="number" id="sd-hf-steps" class="text_pole" value="${dp.steps || 6}" min="1" max="20">
                    </div>
                    <div>
                        <label style="font-size:0.8em; color:#888;">时长 (秒)</label>
                        <input type="number" id="sd-hf-duration" class="text_pole" value="${dp.duration || 3.5}" step="0.5" min="0.5" max="10">
                    </div>
                    <div>
                        <label style="font-size:0.8em; color:#888;">调度器</label>
                        <select id="sd-hf-scheduler" class="text_pole">${schedulerHtml}</select>
                    </div>
                    <div>
                        <label style="font-size:0.8em; color:#888;">帧率倍数</label>
                        <select id="sd-hf-frame-mult" class="text_pole">${frameMultiplierHtml}</select>
                    </div>
                </div>

                <!-- 高级参数 -->
                <details style="margin-top:12px;">
                    <summary style="cursor:pointer; color:#aaa; margin-bottom:8px;">▸ 高级参数</summary>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:6px;">
                        <div>
                            <label style="font-size:0.8em; color:#888;">引导强度 1</label>
                            <input type="number" id="sd-hf-guide1" class="text_pole" value="${dp.guidanceScale || 1}" step="0.1" min="0" max="10">
                        </div>
                        <div>
                            <label style="font-size:0.8em; color:#888;">引导强度 2</label>
                            <input type="number" id="sd-hf-guide2" class="text_pole" value="${dp.guidanceScale2 || 1}" step="0.1" min="0" max="10">
                        </div>
                        <div>
                            <label style="font-size:0.8em; color:#888;">质量</label>
                            <input type="number" id="sd-hf-quality" class="text_pole" value="${dp.quality || 6}" min="1" max="10">
                        </div>
                        <div>
                            <label style="font-size:0.8em; color:#888;">流偏移</label>
                            <input type="number" id="sd-hf-flowshift" class="text_pole" value="${dp.flowShift || 3}" min="0" max="10">
                        </div>
                        <div>
                            <label style="font-size:0.8em; color:#888;">种子</label>
                            <input type="number" id="sd-hf-seed" class="text_pole" value="${dp.seed || 42}">
                        </div>
                        <div style="display:flex; align-items:center;">
                            <input type="checkbox" id="sd-hf-random-seed" ${dp.randomizeSeed !== false ? 'checked' : ''}>
                            <label for="sd-hf-random-seed" style="font-size:0.8em; color:#888; margin-left:4px;">随机种子</label>
                        </div>
                    </div>
                </details>
            </div>`;
    },

    parseConfigFromUI(existingConfig = {}) {
        return {
            accessToken: $('#sd-hf-token').val() || '',
            defaultParams: {
                steps: parseInt($('#sd-hf-steps').val()) || 6,
                duration: parseFloat($('#sd-hf-duration').val()) || 3.5,
                guidanceScale: parseFloat($('#sd-hf-guide1').val()) || 1,
                guidanceScale2: parseFloat($('#sd-hf-guide2').val()) || 1,
                seed: parseInt($('#sd-hf-seed').val()) || 42,
                randomizeSeed: $('#sd-hf-random-seed').is(':checked'),
                quality: parseInt($('#sd-hf-quality').val()) || 6,
                scheduler: $('#sd-hf-scheduler').val() || 'UniPCMultistep',
                flowShift: parseInt($('#sd-hf-flowshift').val()) || 3,
                frameMultiplier: $('#sd-hf-frame-mult').val() || '16',
                negativePrompt: ''
            }
        };
    },

    /**
     * 绑定 UI 事件
     */
    bindEvents(context) {
        const { toastr } = context;
        const self = this;

        // 测试连接按钮
        $('#sd-hf-test').off().on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true).text('测试中...');
            try {
                const config = { accessToken: $('#sd-hf-token').val() };
                const result = await self.testConnection(config);
                if (result.success) {
                    toastr.success(result.message);
                } else {
                    toastr.error(result.message);
                }
            } catch (e) {
                toastr.error(e.message);
            }
            btn.prop('disabled', false).text('🧪 测试');
        });
    }
};

// 注册连接器
if (typeof window !== 'undefined') {
    window.SD_CONNECTORS = window.SD_CONNECTORS || [];
    window.SD_CONNECTORS.push(HuggingFaceVideoConnector);
    window.SD_HuggingFaceVideoConnector = HuggingFaceVideoConnector;
}
