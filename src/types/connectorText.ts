export type ConnectorTextBlock = {
  type: 'connector_text'
  text: string
}

export function isConnectorTextBlock(
  value: unknown,
): value is ConnectorTextBlock {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type?: unknown }).type === 'connector_text' &&
    'text' in value &&
    typeof (value as { text?: unknown }).text === 'string'
  )
}
