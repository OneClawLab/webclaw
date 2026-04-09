export interface AgentState {
  availableAgents: string[]
  defaultAgentId: string
}

export const initialState: AgentState = {
  availableAgents: [],
  defaultAgentId: 'admin',
}
