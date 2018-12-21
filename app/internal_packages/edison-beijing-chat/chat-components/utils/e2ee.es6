import uuid from 'uuid/v4';
import { generateKey } from './rsa';
//import { encryptByAES } from './aes';
import getDb from '../db';
const iniE2ee = async () => {
    const db = await getDb();
    const datas = await db.configs.find({ key: { $in: ['deviceId', 'e2ee_prikey', 'e2ee_pubkey'] } }).exec();
    let deviceId = null;
    if (datas.length < 3) {
        for (let data in datas) {
            if (data.key == 'deviceId') {
                deviceId = data.value; break;
            }
        }
        if (deviceId) {
            await setE2ee(db);
        } else if (datas.length == 2) {
            deviceId = await setDeviceId(db);
        } else {
            deviceId = await setDeviceId(db);
            await setE2ee(db);
        }
    }
    return deviceId;
}
const setDeviceId = (db) => {
    return new Promise((resolve) => {
        require('getmac').getMac(function (err, macAddress) {
            let deviceId;
            if (err) {
                console.warn(err);
                deviceId = uuid();
            }
            else {
                deviceId = macAddress.replace(/:/g, '-');
            }
            resolve(deviceId);
            db.configs.upsert({ key: 'deviceId', value: deviceId, time: Date.now() });
            // console.log(macAddress);
            // console.log(encryptByAES(macAddress, '75ab8e66395f').replace(/[=+]/g, ''));
        });
    })
}
const setE2ee = async (db) => {
    let { pubkey, prikey } = generateKey();
    await db.configs.upsert({ key: 'e2ee_prikey', value: prikey, time: Date.now() });
    await db.configs.upsert({ key: 'e2ee_pubkey', value: pubkey, time: Date.now() });
}
iniE2ee();
export const getPriKey = async (cb) => {
    const db = await getDb();
    let data = await db.configs.find({ key: { $in: ['deviceId', 'e2ee_prikey'] } }).exec();
    if (data.length == 2) {
        return { deviceId: data[0].value, priKey: data[1].value };
    } else {
        return null;
    }
    // db.configs.findOne({ key: 'e2ee_prikey' }).exec().then((data) => {
    //     cb(data);
    // });
}
export const getPubKey = async (cb) => {
    const db = await getDb();
    db.configs.find({ key: { $in: ['deviceId', 'e2ee_pubkey'] } }).exec().then((data) => {
        if (data.length == 2) {
            cb(null, data[0].value, data[1].value);
        }
        else {
            iniE2ee();
            cb('please retry!');
        }
    });
}
export const getDeviceId = async (cb) => {
    const db = await getDb();
    let data = await db.configs.findOne({ key: 'deviceId' }).exec();
    if (data) {
        console.log('*****deviceId-1', data.value);
        return data.value;
    } else {
        const deviceId = await iniE2ee();
        console.log('*****deviceId-2', deviceId);
        return deviceId;
    }
    // db.configs.findOne({ key: 'deviceId' }).exec().then((data) => {
    //     cb(data);
    // });
}
export const setE2eeJid = async (jidLocal, value) => {
    const db = await getDb();
    db.configs.upsert({ key: 'e2ee_' + jidLocal, value, time: Date.now() });
}
export const getE2ees = async (jidLocal) => {
    const db = await getDb();
    let datas = await db.configs.find({
        key: { $in: ['deviceId', 'e2ee_prikey', 'e2ee_pubkey', 'e2ee_' + jidLocal] }
    }).exec();

    if (datas) {
        let d = {};
        datas.forEach((data) => {
            d[data.key] = data.value;
            d[data.key + "_time"] = data.time;
        });
        d['e2ee_time'] = d['deviceId_time'] + d['e2ee_prikey_time'] + d['e2ee_pubkey_time'];
        d['needUpload'] = (d['e2ee_time'] != d['e2ee_' + jidLocal]);
        return d;
    } else {
        return null;
    }
    // db.configs.findOne({ key: 'deviceId' }).exec().then((data) => {
    //     cb(data);
    // });
}

export default {
    getPriKey, getPubKey, getDeviceId, getE2ees, setE2eeJid//, delPubKey
}