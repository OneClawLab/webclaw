### Azure OpenAI 配置
AZURE_OPENAI_API_KEY='<YOUR_AZURE_OPENAI_API_KEY>'

### 请根据你的 Azure OpenAI 实例的实际 endpoint 进行修改
### 例如：https://<your-resource-name>.openai.azure.com
AZURE_OPENAI_BASEURL='https://<YOUR_AZURE_OPENAI_INSTANCE_NAME>.openai.azure.com/openai/v1'

### 用于支持 提供给LLM的  `web_search` 工具的 Tavily API Key
### 请更改为你的 Tavily API Key
### 您可以访问 [tavily官网](https://tavily.com/) 注册并获取你的 API Key
TAVILY_API_KEY='<YOUR_TAVILY_API_KEY>'

### 应用里全局适用的缺省的LLM/Embedding模型名称
### 建议保留默认值，除非你有特殊需求
GLOBAL_LLM_MODEL_NAME='AzureOpenAI/gpt-4.1'
GLOBAL_EMBED_MODEL_NAME='AzureOpenAI/text-embedding-ada-002'
