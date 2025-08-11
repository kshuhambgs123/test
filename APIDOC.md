# Lead Search and Status Check API Documentation

This document provides information on how to use the `/searchLeads` and `/checkleadStatus` endpoints.

## Authentication

Both endpoints require authentication using the `apiauth` middleware.

## Endpoints

### 1. Search Leads

- **Endpoint:** `/searchLeads`
- **Method:** `POST`
- **Description:** This endpoint initiates a lead search process based on the provided Apollo link, number of leads, and file name. It also deducts the appropriate credits from the user's account.

#### Request Parameters

- **Headers:**
  - `Authorization`: Bearer token for authentication.

- **Body:**
  - `apolloLink` (string): The Apollo link to search leads from.
  - `noOfLeads` (number): The number of leads to search (between 1,000 and 50,000).
  - `fileName` (string): The name of the file where the leads will be saved.

#### Response

- **Success:** 
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Lead searched successfully, balance: <remaining_credits>, and log created",
      "balance": <remaining_credits>,
      "log": <log_details>
    }
    ```

- **Error:** 
  - **Status Code:** `400 Bad Request`
  - **Body:** Error message indicating the issue (e.g., missing fields, invalid URL, insufficient credits, etc.)
  - **Status Code:** `500 Internal Server Error`
  - **Body:** 
    ```json
    {
      "message": "<error_message>"
    }
    ```

### 2. Check Lead Status

- **Endpoint:** `/checkleadStatus`
- **Method:** `POST`
- **Description:** This endpoint checks the status of a lead search process and updates the log accordingly. If the search failed or was cancelled, credits are refunded.

#### Request Parameters

- **Headers:**
  - `Authorization`: Bearer token for authentication.

- **Body:**
  - `recordID` (string): The ID of the lead search record to check the status for.

#### Response

- **Success:** 
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Lead status checked successfully",
      "log": <log_details>
    }
    ```
  - If the lead status is failed or cancelled, credits are refunded:
    ```json
    {
      "message": "Lead status failed or cancelled, credits refunded",
      "credits": <remaining_credits>
    }
    ```

- **Error:** 
  - **Status Code:** `400 Bad Request`
  - **Body:** Error message indicating the issue (e.g., failed to check lead status, failed to update log, etc.)
  - **Status Code:** `500 Internal Server Error`
  - **Body:**
    ```json
    {
      "message": "<error_message>"
    }
    ```

## Error Handling

If an error occurs during the processing of any request, the API will return a `500 Internal Server Error` status along with a JSON object containing the error message.

