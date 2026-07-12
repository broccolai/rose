use rose_armor_engine::{
    ArmorEngine, ArmorPlanner, CapRequest, EngineError, PlanningProfileInput, ProfileInput,
    SolveRequest,
};
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmArmorEngine {
    inner: ArmorEngine,
}

#[wasm_bindgen]
pub struct WasmArmorPlanner {
    inner: ArmorPlanner,
}

#[wasm_bindgen]
impl WasmArmorEngine {
    /// Creates a persistent engine from a compact normalized profile.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when deserialization or profile compilation fails.
    #[wasm_bindgen(constructor)]
    pub fn new(profile: JsValue) -> Result<Self, JsValue> {
        let profile: ProfileInput = deserialize(profile, "profile")?;
        let inner = ArmorEngine::new(profile).map_err(|error| to_js_error(&error))?;

        Ok(Self { inner })
    }

    /// # Errors
    ///
    /// Returns a JavaScript error when the summary cannot be serialized.
    pub fn summary(&self) -> Result<JsValue, JsValue> {
        serialize(&self.inner.summary())
    }

    /// # Errors
    ///
    /// Returns a JavaScript error when the request is invalid or the result
    /// cannot be serialized.
    pub fn calculate_caps(&mut self, request: JsValue) -> Result<JsValue, JsValue> {
        let request: CapRequest = deserialize(request, "cap request")?;
        let result = self
            .inner
            .calculate_caps(request)
            .map_err(|error| to_js_error(&error))?;

        serialize(&result)
    }

    /// # Errors
    ///
    /// Returns a JavaScript error when the request is invalid or the result
    /// cannot be serialized.
    pub fn solve(&mut self, request: JsValue) -> Result<JsValue, JsValue> {
        let request: SolveRequest = deserialize(request, "solve request")?;
        let result = self
            .inner
            .solve(request)
            .map_err(|error| to_js_error(&error))?;

        serialize(&result)
    }
}

#[wasm_bindgen]
impl WasmArmorPlanner {
    /// Creates a persistent planner from legal normalized Tier 5 roll profiles.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when deserialization or profile compilation fails.
    #[wasm_bindgen(constructor)]
    pub fn new(profile: JsValue) -> Result<Self, JsValue> {
        let profile: PlanningProfileInput = deserialize(profile, "planning profile")?;
        let inner = ArmorPlanner::new(profile).map_err(|error| to_js_error(&error))?;

        Ok(Self { inner })
    }

    /// # Errors
    ///
    /// Returns a JavaScript error when the summary cannot be serialized.
    pub fn summary(&self) -> Result<JsValue, JsValue> {
        serialize(&self.inner.summary())
    }

    /// # Errors
    ///
    /// Returns a JavaScript error when the request is invalid or the result
    /// cannot be serialized.
    pub fn calculate_caps(&mut self, request: JsValue) -> Result<JsValue, JsValue> {
        let request: CapRequest = deserialize(request, "planning cap request")?;
        let result = self
            .inner
            .calculate_caps(request)
            .map_err(|error| to_js_error(&error))?;

        serialize(&result)
    }

    /// # Errors
    ///
    /// Returns a JavaScript error when the request is invalid or the result
    /// cannot be serialized.
    pub fn solve(&mut self, request: JsValue) -> Result<JsValue, JsValue> {
        let request: SolveRequest = deserialize(request, "planning solve request")?;
        let result = self
            .inner
            .solve(request)
            .map_err(|error| to_js_error(&error))?;

        serialize(&result)
    }
}

fn deserialize<T>(value: JsValue, label: &str) -> Result<T, JsValue>
where
    T: serde::de::DeserializeOwned,
{
    serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&format!("Invalid {label}: {error}")))
}

fn serialize<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value)
        .map_err(|error| JsValue::from_str(&format!("Could not serialize armor result: {error}")))
}

fn to_js_error(error: &EngineError) -> JsValue {
    JsValue::from_str(&error.to_string())
}
