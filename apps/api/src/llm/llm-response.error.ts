type ResponseIssue =
  | 'unexpected_searches'
  | 'missing_searches'
  | 'missing_target'
  | 'unknown_category'
  | 'invalid_price_range'
  | 'output_limit'
  | 'empty_response'
  | 'blocked_response';

export class LlmResponseError extends Error {
  constructor(readonly issue: ResponseIssue) {
    super('Invalid LLM response.');
  }
}
