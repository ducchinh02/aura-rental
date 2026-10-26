
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "booking_events": {
                  Row: {
                    "actor_id": string | null,"booking_id": string,"created_at": string,"data": Json | null,"event": string,"from_status": Database["public"]['Enums']["booking_status"] | null,"id": number,"to_status": Database["public"]['Enums']["booking_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"booking_id": string,"created_at"?: string,"data"?: Json | null,"event": string,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: never,"to_status"?: Database["public"]['Enums']["booking_status"] | null
                  }
                  Update: {
                    "actor_id"?: string | null,"booking_id"?: string,"created_at"?: string,"data"?: Json | null,"event"?: string,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: never,"to_status"?: Database["public"]['Enums']["booking_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_payment_totals"
      referencedColumns: ["booking_id"]
    },{
      foreignKeyName: "booking_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_items": {
                  Row: {
                    "blocked_period": unknown,"booking_id": string,"created_at": string,"id": string,"is_active": boolean,"is_price_custom": boolean,"item_id": string,"price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_period": unknown,"booking_id": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_price_custom"?: boolean,"item_id": string,"price": number
                  }
                  Update: {
                    "blocked_period"?: unknown,"booking_id"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_price_custom"?: boolean,"item_id"?: string,"price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_payment_totals"
      referencedColumns: ["booking_id"]
    },{
      foreignKeyName: "booking_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "item_locations"
      referencedColumns: ["item_id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "branch_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"code": string,"completed_at": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"customer_note": string | null,"damage_fee": number,"delivery_method": Database["public"]['Enums']["delivery_method"],"deposit_required": number,"discount": number,"hold_expires_at": string | null,"id": string,"internal_note": string | null,"late_fee": number,"picked_up_at": string | null,"pickup_date": string,"return_date": string,"returned_at": string | null,"security_deposit": number,"ship_zone": Database["public"]['Enums']["ship_zone"] | null,"shipping_address": string | null,"shipping_fee": number,"source": Database["public"]['Enums']["booking_source"],"status": Database["public"]['Enums']["booking_status"],"subtotal": number,"total": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"code": string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"customer_note"?: string | null,"damage_fee"?: number,"delivery_method"?: Database["public"]['Enums']["delivery_method"],"deposit_required"?: number,"discount"?: number,"hold_expires_at"?: string | null,"id"?: string,"internal_note"?: string | null,"late_fee"?: number,"picked_up_at"?: string | null,"pickup_date": string,"return_date": string,"returned_at"?: string | null,"security_deposit"?: number,"ship_zone"?: Database["public"]['Enums']["ship_zone"] | null,"shipping_address"?: string | null,"shipping_fee"?: number,"source"?: Database["public"]['Enums']["booking_source"],"status"?: Database["public"]['Enums']["booking_status"],"subtotal"?: number,"total"?: never,"updated_at"?: string
                  }
                  Update: {
                    "branch_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"code"?: string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"customer_note"?: string | null,"damage_fee"?: number,"delivery_method"?: Database["public"]['Enums']["delivery_method"],"deposit_required"?: number,"discount"?: number,"hold_expires_at"?: string | null,"id"?: string,"internal_note"?: string | null,"late_fee"?: number,"picked_up_at"?: string | null,"pickup_date"?: string,"return_date"?: string,"returned_at"?: string | null,"security_deposit"?: number,"ship_zone"?: Database["public"]['Enums']["ship_zone"] | null,"shipping_address"?: string | null,"shipping_fee"?: number,"source"?: Database["public"]['Enums']["booking_source"],"status"?: Database["public"]['Enums']["booking_status"],"subtotal"?: number,"total"?: never,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "address": string | null,"close_time": string,"code": string,"created_at": string,"fitting_capacity": number | null,"fitting_slot_minutes": number | null,"id": string,"is_active": boolean,"map_url": string | null,"name": string,"open_time": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"close_time"?: string,"code": string,"created_at"?: string,"fitting_capacity"?: number | null,"fitting_slot_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"map_url"?: string | null,"name": string,"open_time"?: string,"phone"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"close_time"?: string,"code"?: string,"created_at"?: string,"fitting_capacity"?: number | null,"fitting_slot_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"map_url"?: string | null,"name"?: string,"open_time"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "id": string,"name": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "address": string | null,"created_at": string,"email": string | null,"facebook_url": string | null,"full_name": string,"id": string,"is_blacklisted": boolean,"note": string | null,"phone": string,"updated_at": string,"zalo": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"facebook_url"?: string | null,"full_name": string,"id"?: string,"is_blacklisted"?: boolean,"note"?: string | null,"phone": string,"updated_at"?: string,"zalo"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"facebook_url"?: string | null,"full_name"?: string,"id"?: string,"is_blacklisted"?: boolean,"note"?: string | null,"phone"?: string,"updated_at"?: string,"zalo"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"fitting_appointments": {
                  Row: {
                    "booking_id": string | null,"branch_id": string,"created_at": string,"created_by": string | null,"customer_id": string,"customer_note": string | null,"id": string,"internal_note": string | null,"source": Database["public"]['Enums']["booking_source"],"starts_at": string,"status": Database["public"]['Enums']["fitting_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"branch_id": string,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"customer_note"?: string | null,"id"?: string,"internal_note"?: string | null,"source"?: Database["public"]['Enums']["booking_source"],"starts_at": string,"status"?: Database["public"]['Enums']["fitting_status"],"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string | null,"branch_id"?: string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"customer_note"?: string | null,"id"?: string,"internal_note"?: string | null,"source"?: Database["public"]['Enums']["booking_source"],"starts_at"?: string,"status"?: Database["public"]['Enums']["fitting_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fitting_appointments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_payment_totals"
      referencedColumns: ["booking_id"]
    },{
      foreignKeyName: "fitting_appointments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fitting_appointments_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fitting_appointments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fitting_appointments_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"fitting_items": {
                  Row: {
                    "appointment_id": string,"id": string,"product_id": string,"size": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"id"?: string,"product_id": string,"size"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string,"id"?: string,"product_id"?: string,"size"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fitting_items_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "fitting_appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fitting_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_items": {
                  Row: {
                    "code": string,"condition_note": string | null,"created_at": string,"home_branch_id": string,"id": string,"product_id": string,"size": string,"status": Database["public"]['Enums']["item_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"condition_note"?: string | null,"created_at"?: string,"home_branch_id": string,"id"?: string,"product_id": string,"size": string,"status"?: Database["public"]['Enums']["item_status"]
                  }
                  Update: {
                    "code"?: string,"condition_note"?: string | null,"created_at"?: string,"home_branch_id"?: string,"id"?: string,"product_id"?: string,"size"?: string,"status"?: Database["public"]['Enums']["item_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_home_branch_id_fkey"
      columns: ["home_branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"booking_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["payment_kind"],"method": Database["public"]['Enums']["payment_method"],"note": string | null,"paid_at": string,"recorded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"booking_id": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["payment_kind"],"method": Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_at"?: string,"recorded_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["payment_kind"],"method"?: Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_at"?: string,"recorded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_payment_totals"
      referencedColumns: ["booking_id"]
    },{
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_branch_prices": {
                  Row: {
                    "branch_id": string,"extra_day_price": number | null,"price": number,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"extra_day_price"?: number | null,"price": number,"product_id": string
                  }
                  Update: {
                    "branch_id"?: string,"extra_day_price"?: number | null,"price"?: number,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_branch_prices_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_branch_prices_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "created_at": string,"id": string,"is_cover": boolean,"product_id": string,"sort_order": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_cover"?: boolean,"product_id": string,"sort_order"?: number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_cover"?: boolean,"product_id"?: string,"sort_order"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "base_price": number,"category_id": string | null,"color": string | null,"created_at": string,"deposit_amount": number,"description": string | null,"extra_day_price": number,"id": string,"name": string,"occasions": (string)[],"rental_days": number,"security_amount": number,"slug": string,"status": Database["public"]['Enums']["product_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_price": number,"category_id"?: string | null,"color"?: string | null,"created_at"?: string,"deposit_amount"?: number,"description"?: string | null,"extra_day_price"?: number,"id"?: string,"name": string,"occasions"?: (string)[],"rental_days"?: number,"security_amount"?: number,"slug": string,"status"?: Database["public"]['Enums']["product_status"],"updated_at"?: string
                  }
                  Update: {
                    "base_price"?: number,"category_id"?: string | null,"color"?: string | null,"created_at"?: string,"deposit_amount"?: number,"description"?: string | null,"extra_day_price"?: number,"id"?: string,"name"?: string,"occasions"?: (string)[],"rental_days"?: number,"security_amount"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["product_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "branch_id": string | null,"created_at": string,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id"?: string | null,"created_at"?: string,"full_name"?: string,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "branch_id"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "bank_account": string | null,"bank_bin": string | null,"bank_holder": string | null,"cleaning_days": number,"hold_hours": number,"id": boolean,"late_fee_per_day": number,"ship_days_local": number,"ship_days_province": number,"transfer_days": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_account"?: string | null,"bank_bin"?: string | null,"bank_holder"?: string | null,"cleaning_days"?: number,"hold_hours"?: number,"id"?: boolean,"late_fee_per_day"?: number,"ship_days_local"?: number,"ship_days_province"?: number,"transfer_days"?: number,"updated_at"?: string
                  }
                  Update: {
                    "bank_account"?: string | null,"bank_bin"?: string | null,"bank_holder"?: string | null,"cleaning_days"?: number,"hold_hours"?: number,"id"?: boolean,"late_fee_per_day"?: number,"ship_days_local"?: number,"ship_days_province"?: number,"transfer_days"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transfers": {
                  Row: {
                    "booking_id": string | null,"created_at": string,"due_date": string,"from_branch_id": string,"id": string,"item_id": string,"note": string | null,"received_at": string | null,"received_by": string | null,"sent_at": string | null,"sent_by": string | null,"status": Database["public"]['Enums']["transfer_status"],"to_branch_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"created_at"?: string,"due_date": string,"from_branch_id": string,"id"?: string,"item_id": string,"note"?: string | null,"received_at"?: string | null,"received_by"?: string | null,"sent_at"?: string | null,"sent_by"?: string | null,"status"?: Database["public"]['Enums']["transfer_status"],"to_branch_id": string
                  }
                  Update: {
                    "booking_id"?: string | null,"created_at"?: string,"due_date"?: string,"from_branch_id"?: string,"id"?: string,"item_id"?: string,"note"?: string | null,"received_at"?: string | null,"received_by"?: string | null,"sent_at"?: string | null,"sent_by"?: string | null,"status"?: Database["public"]['Enums']["transfer_status"],"to_branch_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transfers_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "booking_payment_totals"
      referencedColumns: ["booking_id"]
    },{
      foreignKeyName: "transfers_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transfers_from_branch_id_fkey"
      columns: ["from_branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transfers_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transfers_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "item_locations"
      referencedColumns: ["item_id"]
    },{
      foreignKeyName: "transfers_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transfers_sent_by_fkey"
      columns: ["sent_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transfers_to_branch_id_fkey"
      columns: ["to_branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "booking_payment_totals": {
                  Row: {
                    "amount_paid": number | null,"balance_due": number | null,"booking_id": string,"security_held": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"item_locations": {
                  Row: {
                    "current_branch_id": string | null,"home_branch_id": string,"in_transit": boolean | null,"item_id": string,"rented_booking_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "booking_items_booking_id_fkey"
      columns: ["rented_booking_id"]
isOneToOne: false
      referencedRelation: "booking_payment_totals"
      referencedColumns: ["booking_id"]
    },{
      foreignKeyName: "booking_items_booking_id_fkey"
      columns: ["rented_booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_items_home_branch_id_fkey"
      columns: ["home_branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "create_booking":
{ Args: { "p_branch_id": string,"p_customer": Json,"p_customer_note"?: string,"p_delivery"?: Database["public"]['Enums']["delivery_method"],"p_items": Json,"p_pickup_date": string,"p_return_date": string,"p_ship_zone"?: Database["public"]['Enums']["ship_zone"],"p_shipping_address"?: string,"p_source"?: Database["public"]['Enums']["booking_source"] }; Returns: {
              "branch_id": string,
"cancel_reason": string | null,
"cancelled_at": string | null,
"code": string,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string,
"customer_note": string | null,
"damage_fee": number,
"delivery_method": Database["public"]['Enums']["delivery_method"],
"deposit_required": number,
"discount": number,
"hold_expires_at": string | null,
"id": string,
"internal_note": string | null,
"late_fee": number,
"picked_up_at": string | null,
"pickup_date": string,
"return_date": string,
"returned_at": string | null,
"security_deposit": number,
"ship_zone": Database["public"]['Enums']["ship_zone"] | null,
"shipping_address": string | null,
"shipping_fee": number,
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["booking_status"],
"subtotal": number,
"total": number | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_fitting":
{ Args: { "p_branch_id": string,"p_customer": Json,"p_customer_note"?: string,"p_items"?: Json,"p_source"?: Database["public"]['Enums']["booking_source"],"p_starts_at": string }; Returns: {
              "booking_id": string | null,
"branch_id": string,
"created_at": string,
"created_by": string | null,
"customer_id": string,
"customer_note": string | null,
"id": string,
"internal_note": string | null,
"source": Database["public"]['Enums']["booking_source"],
"starts_at": string,
"status": Database["public"]['Enums']["fitting_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "fitting_appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_fitting_slots":
{ Args: { "p_branch_id": string,"p_date": string }; Returns: {
              "remaining": number,"starts_at": string
            }[]
                           },
"get_unavailable_dates":
{ Args: { "p_branch_id": string,"p_delivery"?: Database["public"]['Enums']["delivery_method"],"p_from": string,"p_product_id": string,"p_ship_zone"?: Database["public"]['Enums']["ship_zone"],"p_size": string,"p_to": string }; Returns: string[]
                           },
"lookup_booking":
{ Args: { "p_code": string,"p_phone": string }; Returns: Json
                           },
"quote_rental":
{ Args: { "p_branch_id": string,"p_delivery"?: Database["public"]['Enums']["delivery_method"],"p_pickup_date": string,"p_product_id": string,"p_return_date": string,"p_ship_zone"?: Database["public"]['Enums']["ship_zone"],"p_size": string }; Returns: {
              "available": boolean,"deposit": number,"price": number,"rental_days": number
            }[]
                           }
          }
          Enums: {
            "app_role": "owner"|"staff","booking_source": "web"|"facebook"|"zalo"|"phone"|"walk_in","booking_status": "pending"|"confirmed"|"picked_up"|"returned"|"completed"|"cancelled","delivery_method": "pickup"|"ship","fitting_status": "booked"|"done"|"no_show"|"cancelled","item_status": "active"|"maintenance"|"retired","payment_kind": "payment"|"refund"|"security_hold"|"security_return","payment_method": "cash"|"bank"|"momo","product_status": "draft"|"active"|"archived","ship_zone": "local"|"province","transfer_status": "pending"|"in_transit"|"received"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["owner", "staff"],"booking_source": ["web", "facebook", "zalo", "phone", "walk_in"],"booking_status": ["pending", "confirmed", "picked_up", "returned", "completed", "cancelled"],"delivery_method": ["pickup", "ship"],"fitting_status": ["booked", "done", "no_show", "cancelled"],"item_status": ["active", "maintenance", "retired"],"payment_kind": ["payment", "refund", "security_hold", "security_return"],"payment_method": ["cash", "bank", "momo"],"product_status": ["draft", "active", "archived"],"ship_zone": ["local", "province"],"transfer_status": ["pending", "in_transit", "received", "cancelled"]
          }
        }
} as const
