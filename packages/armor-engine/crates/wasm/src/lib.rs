use rose_armor_engine::ArmorEngine;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmArmorEngine {
    inner: ArmorEngine,
}

#[wasm_bindgen]
impl WasmArmorEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(profile: JsValue) -> Result<Self, JsValue> {
        let profile = from_value(profile, "profile")?;
        let inner = ArmorEngine::new(profile).map_err(engine_error)?;
        Ok(Self { inner })
    }

    pub fn summary(&self) -> Result<JsValue, JsValue> {
        to_value(&self.inner.summary())
    }

    pub fn calculate_caps(&mut self, request: JsValue) -> Result<JsValue, JsValue> {
        let request = from_value(request, "cap request")?;
        let result = self.inner.calculate_caps(request).map_err(engine_error)?;
        to_value(&result)
    }

    pub fn solve(&mut self, request: JsValue) -> Result<JsValue, JsValue> {
        let request = from_value(request, "solve request")?;
        let result = self.inner.solve(request).map_err(engine_error)?;
        to_value(&result)
    }
}

fn from_value<T>(value: JsValue, label: &str) -> Result<T, JsValue>
where
    T: serde::de::DeserializeOwned,
{
    serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&format!("Invalid {label}: {error}")))
}

fn to_value<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value)
        .map_err(|error| JsValue::from_str(&format!("Could not serialize armor result: {error}")))
}

fn engine_error(error: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&error.to_string())
}
