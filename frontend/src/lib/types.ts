export interface BaseModel {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Convert snake_case fields to camelCase
// export interface {FeatureName} extends BaseModel {
//   fieldName: string;  // field_name -> fieldName
//   optionalField?: number;  // optional_field -> optionalField
// }
//
// // For nested resources
// export interface {NestedFeatureName} extends BaseModel {
//   parentId: string;  // parent_id -> parentId
//   childField: string;  // child_field -> childField
// }
