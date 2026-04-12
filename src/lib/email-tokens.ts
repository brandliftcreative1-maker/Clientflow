export interface TokenData {
  firstName?: string | null
  businessName?: string | null
  yourName?: string | null
}

export function replaceTokens(template: string, data: TokenData): string {
  return template
    .replace(/\[First Name\]/gi, data.firstName || 'there')
    .replace(/\[Business Name\]/gi, data.businessName || 'our business')
    .replace(/\[Your Name\]/gi, data.yourName || 'The Team')
}
